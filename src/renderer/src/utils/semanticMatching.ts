import * as tf from '@tensorflow/tfjs'
import { load as loadEncoder } from '@tensorflow-models/universal-sentence-encoder'

// Logging levels
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class SemanticMatcher {
  private encoderModel: any | null = null
  private bulletPointEmbeddings: tf.Tensor | null = null
  private bulletPoints: string[] = []
  private originalBulletPoints: string[] = []
  private bulletPointMap = new Map<string, string>()
  private matchedPoints = new Set<string>()
  private transcriptionHistory: string[] = []
  private isModelLoading: boolean = false
  private logLevel: LogLevel = LogLevel.INFO
  private modelLoadRetries: number = 0
  private MAX_RETRIES: number = 3
  private hasLoadBeenAttempted: boolean = false
  private embeddings: Float32Array | null = null
  private logger: (level: LogLevel, message: string) => void = console.log
  private onMatchFound: (matchedPoint: string) => void
  private lastProcessedTranscript = ''
  private processingDebounceTimer: number | null = null
  private processingLock = false
  private needsRecompute = true

  constructor(onMatchFound: (point: string) => void) {
    this.onMatchFound = onMatchFound
    this.log(LogLevel.INFO, 'SemanticMatcher initialized')

    // Start loading the model immediately
    this.loadModel()
      .then((success) => {
        if (success) {
          this.log(LogLevel.INFO, '🔥 Model loaded at initialization')
          this.hasLoadBeenAttempted = true
        } else {
          this.log(LogLevel.WARN, '⚠️ Initial model load failed, will retry when needed')
        }
      })
      .catch((err) => {
        this.log(LogLevel.ERROR, '❌ Initial model load error:', err)
      })
  }

  private log(level: LogLevel, message: string, ...args: any[]) {
    if (level >= this.logLevel) {
      const prefix = (() => {
        switch (level) {
          case LogLevel.DEBUG:
            return '[SEMANTIC-DEBUG]'
          case LogLevel.INFO:
            return '[SEMANTIC-INFO]'
          case LogLevel.WARN:
            return '[SEMANTIC-WARN]'
          case LogLevel.ERROR:
            return '[SEMANTIC-ERROR]'
        }
      })()
      console.log(prefix, message, ...args)
    }
  }

  /**
   * Load the Universal Sentence Encoder model
   */
  public async loadModel(): Promise<boolean> {
    if (this.encoderModel) {
      this.log(LogLevel.INFO, 'Model already loaded')
      return true
    }

    if (this.isModelLoading) {
      this.log(LogLevel.INFO, 'Model is already being loaded')
      return false
    }

    if (this.modelLoadRetries >= this.MAX_RETRIES) {
      this.log(LogLevel.ERROR, `❌ Maximum model load retries (${this.MAX_RETRIES}) exceeded`)
      return false
    }

    try {
      this.isModelLoading = true
      this.modelLoadRetries++
      this.log(
        LogLevel.INFO,
        `🔄 Loading Universal Sentence Encoder model (attempt ${this.modelLoadRetries})...`
      )

      // Load the model with a timeout
      const loadPromise = loadEncoder()
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Model load timeout')), 10000)
      })

      // Race between loading and timeout
      this.encoderModel = await Promise.race([loadPromise, timeoutPromise])
      this.hasLoadBeenAttempted = true

      this.log(LogLevel.INFO, '✅ Universal Sentence Encoder model loaded successfully')
      this.isModelLoading = false

      // If we have bullet points, compute embeddings immediately
      if (this.bulletPoints.length > 0) {
        this.log(
          LogLevel.INFO,
          '🔄 Computing embeddings for bullet points immediately after model load...'
        )
        await this.computeBulletPointEmbeddings()
      }

      return true
    } catch (error) {
      this.log(
        LogLevel.ERROR,
        `❌ Error loading Universal Sentence Encoder model (attempt ${this.modelLoadRetries}):`,
        error
      )
      this.isModelLoading = false

      // Schedule a retry if we haven't exceeded max retries
      if (this.modelLoadRetries < this.MAX_RETRIES) {
        const retryDelay = Math.min(2000 * Math.pow(2, this.modelLoadRetries - 1), 10000)
        this.log(LogLevel.INFO, `⏱️ Scheduling model load retry in ${retryDelay}ms...`)

        setTimeout(() => {
          this.loadModel().catch((err) => {
            this.log(LogLevel.ERROR, '❌ Retry load error:', err)
          })
        }, retryDelay)
      }

      return false
    }
  }

  /**
   * Set or update the bullet points to match against
   */
  public async setBulletPoints(bulletPoints: string[]): Promise<boolean> {
    // Store original bullet points first
    this.originalBulletPoints = [...bulletPoints]

    // Normalize the bullet points for better matching
    const normalizedBulletPoints = bulletPoints.map((point) => this.normalizeText(point))

    // Create mapping from normalized to original
    this.bulletPointMap.clear()
    normalizedBulletPoints.forEach((normalized, i) => {
      this.bulletPointMap.set(normalized, this.originalBulletPoints[i])
    })

    // If the bullet points are the same, don't re-compute embeddings
    if (
      JSON.stringify(this.bulletPoints) === JSON.stringify(normalizedBulletPoints) &&
      this.bulletPointEmbeddings
    ) {
      this.log(LogLevel.INFO, 'Bullet points unchanged, skipping embedding computation')
      return true
    }

    this.bulletPoints = [...normalizedBulletPoints]
    this.log(
      LogLevel.INFO,
      `📋 Setting ${bulletPoints.length} normalized bullet points:`,
      this.bulletPoints
    )

    // Clear the matched points when bullet points change
    this.matchedPoints.clear()

    // If there are no bullet points, clean up and return
    if (bulletPoints.length === 0) {
      this.log(LogLevel.INFO, 'No bullet points provided, clearing embeddings')
      this.cleanupEmbeddings()
      return true
    }

    // Make sure the model is loaded
    if (!this.encoderModel) {
      const isLoaded = await this.loadModel()
      if (!isLoaded) {
        this.log(LogLevel.ERROR, '❌ Failed to load model for bullet points')
        return false
      }
    }

    // Compute embeddings for bullet points
    return this.computeBulletPointEmbeddings()
  }

  /**
   * Process a transcription to find potential matches
   */
  async processTranscription(text: string): Promise<void> {
    // Skip processing if the text is too short
    if (text.length < 3) {
      return
    }

    // Skip if we're currently processing or this is a duplicate of the last processed transcript
    if (this.processingLock || text === this.lastProcessedTranscript) {
      this.log(LogLevel.DEBUG, `Skipping duplicate or locked transcription: "${text}"`)
      return
    }

    // Set processing lock
    this.processingLock = true
    this.lastProcessedTranscript = text

    // Clear any pending debounce timers
    if (this.processingDebounceTimer !== null) {
      clearTimeout(this.processingDebounceTimer)
    }

    try {
      this.log(LogLevel.INFO, `📝 Processing transcription: "${text}"`)

      // Add to history
      this.transcriptionHistory.push(text)

      // Limit history length
      if (this.transcriptionHistory.length > 10) {
        this.transcriptionHistory.shift()
      }

      // Skip if no bullet points
      if (this.bulletPoints.length === 0) {
        this.log(LogLevel.WARN, '⚠️ No bullet points available for matching')
        return
      }

      // Create text variants for matching
      const variants = this.createTextVariants(text)
      this.log(LogLevel.DEBUG, `🔍 Checking ${variants.length} text variants:`, variants)

      // Load model if needed
      if (!this.encoderModel) {
        this.log(LogLevel.DEBUG, '🔄 Loading model...')
        const modelLoaded = await this.loadModel()

        if (!modelLoaded) {
          if (this.modelLoadRetries < this.MAX_RETRIES) {
            this.modelLoadRetries++
            this.log(
              LogLevel.WARN,
              `⚠️ Retrying model load (${this.modelLoadRetries}/${this.MAX_RETRIES})`
            )
            const modelLoaded = await this.loadModel()
            if (!modelLoaded) {
              this.log(LogLevel.ERROR, '❌ Failed to load model for matching')
              return
            }
          } else {
            this.log(LogLevel.ERROR, '❌ Model could not be loaded after multiple attempts')
            return
          }
        }
      }

      // Compute bullet point embeddings if needed
      if (this.bulletPoints.length > 0 && (!this.embeddings || this.needsRecompute)) {
        this.log(LogLevel.INFO, '🔄 Computing embeddings for bullet points...')
        const embeddingsComputed = await this.computeBulletPointEmbeddings()
        this.needsRecompute = false

        if (!embeddingsComputed) {
          this.log(LogLevel.ERROR, '❌ Failed to compute bullet point embeddings')
          return
        }
      } else {
        if (this.bulletPoints.length === 0) {
          this.log(LogLevel.WARN, '⚠️ No bullet points available for matching')
          return
        }
      }

      try {
        // Compute embeddings for variants
        this.log(LogLevel.DEBUG, '🔄 Computing embeddings for text variants...')
        const variantEmbeddings = await this.encoderModel.embed(variants)
        this.log(LogLevel.DEBUG, '✅ Text embeddings computed')

        // Check if bullet point embeddings exist
        if (!this.bulletPointEmbeddings) {
          this.log(
            LogLevel.ERROR,
            '❌ Bullet point embeddings are null - cannot compute similarities'
          )
          return
        }

        // Compute similarities
        this.log(LogLevel.DEBUG, '🔄 Computing similarities...')
        const similarities = tf.matMul(variantEmbeddings, this.bulletPointEmbeddings, false, true)
        this.log(LogLevel.DEBUG, '✅ Similarities computed')

        // Get matches
        const similarityValues = await similarities.data()
        this.log(LogLevel.DEBUG, '📊 Similarity values retrieved')

        // Find matches above threshold
        const matches = this.findMatches(new Float32Array(similarityValues), variants.length)

        // Cleanup tensors
        variantEmbeddings.dispose()
        similarities.dispose()
      } catch (error) {
        this.log(LogLevel.ERROR, '❌ Error in semantic matching:', error)
      }

      // Release the lock after a delay to prevent rapid reprocessing
      this.processingDebounceTimer = window.setTimeout(() => {
        this.processingLock = false
        this.processingDebounceTimer = null
      }, 1000) // 1 second debounce
    } catch (err) {
      this.log(LogLevel.ERROR, `❌ Error in semantic matching: ${err}`)
      this.processingLock = false
    }
  }

  /**
   * Prepare different text variants for matching
   */
  private createTextVariants(text: string): string[] {
    // Normalize and clean input text
    const normalizedText = this.normalizeText(text)

    // The current text
    const variants = [normalizedText]

    // Create word-level combinations for stronger matching
    if (normalizedText.split(' ').length >= 4) {
      // Add sliding window of words for more precise matching
      const words = normalizedText.split(' ')
      for (let i = 0; i < words.length - 3; i++) {
        const phrase = words.slice(i, i + 5).join(' ')
        if (phrase.length > 10) {
          // Only add meaningful phrases
          variants.push(phrase)
        }
      }
    }

    // Process history
    if (this.transcriptionHistory.length > 0) {
      // Normalize each history item
      const normalizedHistory = this.transcriptionHistory.map((item) => this.normalizeText(item))

      // The last 2-3 texts combined (for context)
      if (normalizedHistory.length >= 2) {
        variants.push(normalizedHistory.slice(-2).join(' '))
      }

      if (normalizedHistory.length >= 3) {
        variants.push(normalizedHistory.slice(-3).join(' '))
      }

      // All recent text combined (for longer context)
      if (normalizedHistory.length > 3) {
        variants.push(normalizedHistory.join(' '))
      }
    }

    // Log the variants we're checking
    this.log(LogLevel.DEBUG, `Created ${variants.length} text variants for matching:`, variants)

    return variants
  }

  /**
   * Normalize text for better matching
   */
  private normalizeText(text: string): string {
    if (!text) return ''

    // Convert to lowercase
    let normalized = text.toLowerCase()

    // Replace common word variations
    normalized = normalized
      .replace(/i've/g, 'i have')
      .replace(/i'm/g, 'i am')
      .replace(/don't/g, 'do not')
      .replace(/didn't/g, 'did not')
      .replace(/won't/g, 'will not')
      .replace(/can't/g, 'cannot')
      .replace(/&/g, 'and')
      .replace(/5/g, 'five') // Convert numbers to words for better matching
      .replace(/yrs/g, 'years')
      .replace(/yr/g, 'year')
      .replace(/experience/g, 'experience') // Ensure key words are preserved

    // Remove punctuation
    normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')

    // Trim extra whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim()

    return normalized
  }

  /**
   * Find matches in similarity values
   */
  private findMatches(
    values: Float32Array | Uint8Array | Int32Array,
    numVariants: number
  ): string[] {
    // Increase threshold for better matching precision
    const SIMILARITY_THRESHOLD = 0.6
    // Require higher threshold for longer bullet points
    const getThresholdForBulletPoint = (text: string): number => {
      const length = text.length
      if (length > 50) return SIMILARITY_THRESHOLD + 0.05 // Longer texts need higher threshold
      if (length < 20) return SIMILARITY_THRESHOLD - 0.05 // Shorter texts can use lower threshold
      return SIMILARITY_THRESHOLD
    }

    const matches: string[] = []
    const matchIndices = new Set<number>()

    // Convert values to regular array for easier handling
    const valuesArray = Array.from(values)

    // Log all similarity scores for debugging
    let closestMatch = { score: 0, index: -1, variant: -1 }
    let debugMsg = '📊 Similarity scores (showing highest per bullet point):\n'

    for (let j = 0; j < this.bulletPoints.length; j++) {
      let highestScore = 0
      let bestVariant = -1
      const bulletPointThreshold = getThresholdForBulletPoint(this.bulletPoints[j])

      for (let i = 0; i < numVariants; i++) {
        const similarity = valuesArray[i * this.bulletPoints.length + j]
        if (similarity > highestScore) {
          highestScore = similarity
          bestVariant = i
        }

        // Track the closest match overall
        if (similarity > closestMatch.score) {
          closestMatch = { score: similarity, index: j, variant: i }
        }
      }

      // Add the highest score for this bullet point to the debug message
      let matchStatus = highestScore >= bulletPointThreshold ? '✅' : '❌'
      debugMsg += `${matchStatus} "${this.bulletPoints[j]}" (threshold ${bulletPointThreshold.toFixed(2)}): ${highestScore.toFixed(4)} (variant ${bestVariant + 1})\n`
    }

    this.log(LogLevel.INFO, debugMsg)

    // Log information about the closest match if none are above threshold
    if (closestMatch.score < SIMILARITY_THRESHOLD && closestMatch.index >= 0) {
      this.log(
        LogLevel.INFO,
        `📏 Closest match but below threshold (${SIMILARITY_THRESHOLD.toFixed(2)}): ` +
          `"${this.bulletPoints[closestMatch.index]}" with score ${closestMatch.score.toFixed(4)}`
      )
    }

    // Check for matches in each variant
    for (let i = 0; i < numVariants; i++) {
      for (let j = 0; j < this.bulletPoints.length; j++) {
        const normalizedBulletPoint = this.bulletPoints[j]
        const originalBulletPoint =
          this.bulletPointMap.get(normalizedBulletPoint) || normalizedBulletPoint

        // Skip if this point has already been matched
        if (this.matchedPoints.has(normalizedBulletPoint)) {
          continue
        }

        const similarity = valuesArray[i * this.bulletPoints.length + j]
        const bulletPointThreshold = getThresholdForBulletPoint(normalizedBulletPoint)

        if (similarity >= bulletPointThreshold) {
          this.log(
            LogLevel.INFO,
            `🎯 Match found in variant ${i + 1} with similarity ${similarity.toFixed(4)}: "${normalizedBulletPoint}" (original: "${originalBulletPoint}")`
          )

          matchIndices.add(j)
          this.matchedPoints.add(normalizedBulletPoint)

          // Add the original bullet point to matches (not the normalized version)
          matches.push(originalBulletPoint)

          // Notify that a match was found (with ORIGINAL bullet point)
          this.onMatchFound(originalBulletPoint)
        }
      }
    }

    // Lower the threshold for strong contenders - if any match is very close (85% of threshold)
    // and there are no matches above threshold, consider it a potential match
    if (
      matches.length === 0 &&
      closestMatch.score >= SIMILARITY_THRESHOLD * 0.85 &&
      closestMatch.index >= 0
    ) {
      this.log(
        LogLevel.INFO,
        `⚠️ No match above threshold, but found close contender with score ${closestMatch.score.toFixed(4)}: ` +
          `"${this.bulletPoints[closestMatch.index]}"`
      )

      // Add as potential match
      const normalizedBulletPoint = this.bulletPoints[closestMatch.index]
      const originalBulletPoint =
        this.bulletPointMap.get(normalizedBulletPoint) || normalizedBulletPoint

      if (!this.matchedPoints.has(normalizedBulletPoint)) {
        this.log(LogLevel.INFO, `🎯 Adding close contender as match: "${originalBulletPoint}"`)
        this.matchedPoints.add(normalizedBulletPoint)
        matches.push(originalBulletPoint)
        this.onMatchFound(originalBulletPoint)
      }
    }

    return matches
  }

  /**
   * Cleanup embeddings when no longer needed
   */
  private cleanupEmbeddings(): void {
    if (this.bulletPointEmbeddings) {
      this.log(LogLevel.DEBUG, 'Cleaning up previous embeddings')
      this.bulletPointEmbeddings.dispose()
      this.bulletPointEmbeddings = null
    }
  }

  /**
   * Reset the state of the matcher
   */
  public reset(): void {
    this.log(LogLevel.INFO, '🔄 Resetting semantic matcher state')
    this.matchedPoints.clear()
    this.bulletPointMap.clear()
    this.transcriptionHistory = []
    this.embeddings = null
    this.lastProcessedTranscript = ''
    this.processingLock = false
    if (this.processingDebounceTimer !== null) {
      clearTimeout(this.processingDebounceTimer)
      this.processingDebounceTimer = null
    }
    // We don't dispose the model as it might be reused
  }

  /**
   * Clean up all resources
   */
  public dispose(): void {
    this.log(LogLevel.INFO, '🧹 Disposing semantic matcher resources')
    this.cleanupEmbeddings()
    this.bulletPoints = []
    this.matchedPoints.clear()
    this.transcriptionHistory = []
    this.bulletPointMap.clear()
    this.embeddings = null
    // We don't dispose the model as it might be reused
  }

  /**
   * Compute embeddings for bullet points
   */
  private async computeBulletPointEmbeddings(): Promise<boolean> {
    if (!this.encoderModel || this.bulletPoints.length === 0) {
      this.log(LogLevel.WARN, 'Cannot compute embeddings: model not loaded or no bullet points')
      return false
    }

    try {
      this.log(LogLevel.INFO, '🔄 Computing embeddings for bullet points...')

      // Clean up previous embeddings
      this.cleanupEmbeddings()

      // Compute new embeddings
      this.bulletPointEmbeddings = await this.encoderModel.embed(this.bulletPoints)

      if (this.bulletPointEmbeddings) {
        this.log(
          LogLevel.INFO,
          `✅ Embeddings computed successfully for ${this.bulletPoints.length} bullet points. ` +
            `Shape: [${this.bulletPointEmbeddings.shape}]`
        )
        return true
      } else {
        this.log(LogLevel.ERROR, '❌ Failed to compute embeddings: result is null')
        return false
      }
    } catch (error) {
      this.log(LogLevel.ERROR, '❌ Error computing bullet point embeddings:', error)
      return false
    }
  }
}

export default SemanticMatcher
