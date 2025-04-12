import { Modal, Box, Typography, Button, Grid } from '@mui/material'
import { EyeContactBox } from './EyeContactBox' // update import if needed

export const AssistanceModePreviewModal = ({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="assistance-mode-preview"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 4,
          maxWidth: 1000,
          width: '95%',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        <Typography variant="h6" sx={{ mb: 3 }}>
          Preview Assistance Modes
        </Typography>

        <Typography variant="h5" sx={{ mb: 3 }}>
          Question: Explain how a REST API works.
        </Typography>

        <Grid container spacing={2} wrap="nowrap" sx={{ overflowX: 'hidden' }}>
          {[
            {
              key: 'Fast',
              text: 'They let systems talk over HTTP using endpoints. You send data and get a response back in JSON.',
              desc: 'Quick and to the point for confident users.'
            },
            {
              key: 'Balanced',
              text: 'A REST API is a way for systems to talk to each other using URLs and HTTP methods like GET and POST. Each endpoint represents a resource, and you send or receive data usually in JSON format.',
              desc: 'A mix of brevity and depth for flexible understanding.'
            },
            {
              key: 'Max',
              text: 'A REST API is a way for two systems to communicate over the web using HTTP. It organizes data as “resources” accessible through unique URLs. Each resource supports actions like GET (fetch), POST (create), PUT (update), and DELETE. REST follows statelessness, meaning each call contains all needed info, and responses are usually in JSON format. It’s widely used due to its simplicity and consistency.',
              desc: 'In-depth explanation for full guidance and clarity.'
            }
          ].map(({ key, text, desc }) => (
            // @ts-ignore
            <Grid
              key={key}
              item
              sx={{
                width: '33.33%',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                {key}
              </Typography>
              <EyeContactBox mode="normal" width="100%" text={text} />
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                {desc}
              </Typography>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
