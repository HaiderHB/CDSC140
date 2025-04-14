import React, { useEffect, useRef, useState } from 'react'

interface SpritzReaderProps {
  text: string
  wpm?: number
  size?: number
  stopDuration?: number
}
interface RapidReadProps {
  text: string
}

const RapidRead: React.FC<RapidReadProps> = ({ text }) => {
  const renderBionicWord = (word: string, index: number) => {
    const splitIndex = Math.ceil(word.length * 0.4) // 40% of the word bolded
    const boldPart = word.slice(0, splitIndex)
    const restPart = word.slice(splitIndex)

    return (
      <span key={index}>
        <strong>{boldPart}</strong>
        <span style={{ fontWeight: 100, opacity: 0.5 }}>{restPart}</span>{' '}
      </span>
    )
  }

  const words = text.split(/\s+/)

  return <div>{words.map((word, index) => renderBionicWord(word, index))}</div>
}

const SpritzReader: React.FC<SpritzReaderProps> = ({
  text,
  wpm = 400,
  size = 2,
  stopDuration = 1500
}) => {
  const words = text.split(' ')
  const [currentIndex, setCurrentIndex] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const msPerWord = 60000 / wpm

  useEffect(() => {
    startLoop()
    return () => {
      stopLoop()
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current)
    }
  }, [text, wpm])

  const startLoop = () => {
    stopLoop()
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= words.length - 1) {
          clearInterval(intervalRef.current!)
          loopTimeoutRef.current = setTimeout(() => {
            setCurrentIndex(0)
            startLoop()
          }, stopDuration)
          return prev
        }
        return prev + 1
      })
    }, msPerWord)
  }

  const stopLoop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  const renderSpritzWord = (word: string) => {
    const orpIndex = Math.floor(word.length / 2)

    const pre = word.slice(0, orpIndex)
    const focus = word[orpIndex] || ''
    const post = word.slice(orpIndex + 1)

    return (
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: `${size}rem`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          maxWidth: '300px',
          maxHeight: '100px',
          userSelect: 'none',
          pointerEvents: 'none',
          backgroundColor: 'transparent',
          border: 'none',
          caretColor: 'transparent',
          outline: 'none'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span style={{ textAlign: 'right', minWidth: `${size * 3}ch` }}>{pre}</span>
          <span
            style={{
              color: 'red',
              caretColor: 'transparent',
              outline: 'none',
              userSelect: 'none',
              pointerEvents: 'none'
            }}
          >
            {focus}
          </span>

          <span style={{ textAlign: 'left', minWidth: `${size * 3}ch` }}>{post}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        height: `${size * 2}rem`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        pointerEvents: 'none',
        backgroundColor: 'transparent',
        border: 'none',
        caretColor: 'transparent',
        outline: 'none'
      }}
    >
      {renderSpritzWord(words[currentIndex])}
    </div>
  )
}

export { SpritzReader, RapidRead }
