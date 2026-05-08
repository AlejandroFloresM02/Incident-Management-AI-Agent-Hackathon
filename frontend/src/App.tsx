import { useMemo, useState } from 'react'
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from '@mui/material'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import ContentPasteSearchOutlinedIcon from '@mui/icons-material/ContentPasteSearchOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import PlaylistAddCheckOutlinedIcon from '@mui/icons-material/PlaylistAddCheckOutlined'
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import TroubleshootOutlinedIcon from '@mui/icons-material/TroubleshootOutlined'
import { FaPaperPlane } from 'react-icons/fa'

const drawerWidth = 264

const sampleIncident = `INC-48291 | P1 | Checkout API latency spike
Service: payments-gateway
Window: 10:12-10:38 UTC
Symptoms: 38% increase in 5xx responses, p95 latency above 8s, queue depth rising.
Recent change: fraud scoring model rollout at 09:55 UTC.
Logs: upstream timeout from fraud-score-v3, circuit breaker opened, retry storm detected.`

const resolutionSteps = [
  'Pause the fraud-score-v3 rollout and route traffic back to the stable v2 endpoint.',
  'Reduce payment gateway retry attempts from 3 to 1 while upstream latency remains elevated.',
  'Clear the delayed payment authorization queue in controlled batches.',
  'Monitor 5xx rate, p95 latency, queue depth, and circuit breaker status for 30 minutes.',
  'Re-enable the rollout only after fraud scoring p95 remains below 750ms for two release windows.',
]

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1f6feb',
    },
    secondary: {
      main: '#0f766e',
    },
    background: {
      default: '#f7f8fb',
      paper: '#ffffff',
    },
    text: {
      primary: '#172033',
      secondary: '#657085',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontSize: '1.85rem',
      fontWeight: 750,
      letterSpacing: 0,
    },
    h2: {
      fontSize: '1.1rem',
      fontWeight: 740,
      letterSpacing: 0,
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          border: '1px solid #e4e8f0',
          boxShadow: '0 10px 28px rgba(23, 32, 51, 0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 42,
        },
      },
    },
  },
})

function Sidebar({ onClose }: { onClose?: () => void }) {
  const items = [
    { label: 'Incident Intake', icon: <ContentPasteSearchOutlinedIcon /> },
    { label: 'Similar Cases', icon: <HistoryOutlinedIcon /> },
    { label: 'Resolution Plan', icon: <PlaylistAddCheckOutlinedIcon /> },
    { label: 'RCA Report', icon: <FactCheckOutlinedIcon /> },
  ]

  return (
    <Box sx={{ height: '100%', bgcolor: '#101827', color: 'white' }}>
      <Stack spacing={2.5} sx={{ p: 3 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: '#1f6feb', width: 38, height: 38 }}>
            <ShieldOutlinedIcon fontSize="small" />
          </Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Incident Copilot
            </Typography>
            <Typography variant="caption" sx={{ color: '#a9b6cb' }}>
              AI operations desk
            </Typography>
          </Box>
        </Stack>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
      </Stack>
      <List sx={{ px: 1.5 }}>
        {items.map((item, index) => (
          <ListItemButton
            key={item.label}
            selected={index === 0}
            onClick={onClose}
            sx={{
              borderRadius: 1.5,
              mb: 0.5,
              color: '#d7deeb',
              '&.Mui-selected': {
                bgcolor: 'rgba(31,111,235,0.22)',
                color: 'white',
              },
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.08)',
              },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.label}
              slotProps={{ primary: { sx: { fontWeight: 700 } } }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Paper sx={{ p: { xs: 2, md: 2.5 }, height: '100%' }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center' }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: '#e9f2ff', color: '#1f6feb' }}>
            {icon}
          </Avatar>
          <Typography variant="h2">{title}</Typography>
        </Stack>
        {children}
      </Stack>
    </Paper>
  )
}

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [incidentText, setIncidentText] = useState(sampleIncident)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('Mock analysis ready')

  const summarizedIssue = useMemo(
    () =>
      'Payments checkout is experiencing elevated latency and 5xx errors after the fraud-score-v3 rollout. Logs point to upstream timeout failures, retry amplification, and an open circuit breaker causing authorization queues to grow.',
    [],
  )

  const rcaReport = useMemo(
    () =>
      'Root cause: fraud-score-v3 introduced slower response behavior under production traffic, which exceeded the payment gateway timeout budget. The gateway retried failed calls aggressively, amplifying load and delaying queued authorizations.\n\nImpact: checkout users saw intermittent payment failures and slow confirmations for approximately 26 minutes. No evidence of data loss is present in the supplied logs.\n\nCorrective actions: roll back the model endpoint, tune retry policy, add rollout guardrails for dependency p95 latency, and require circuit breaker telemetry checks before future model promotions.',
    [],
  )

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setStatus(`Loaded ${file.name} for mock analysis`)

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setIncidentText(reader.result)
      }
    }
    reader.readAsText(file)
  }

  const handleAction = (message: string) => {
    setStatus(message)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar
          position="fixed"
          color="inherit"
          elevation={0}
          sx={{
            borderBottom: '1px solid #e4e8f0',
            width: { md: `calc(100% - ${drawerWidth}px)` },
            ml: { md: `${drawerWidth}px` },
            bgcolor: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <Toolbar sx={{ gap: 2 }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { md: 'none' } }}
              aria-label="Open navigation"
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h1">Incident Management AI Copilot</Typography>
              <Typography variant="body2" color="text.secondary">
                Triage logs, retrieve precedent, and draft RCA notes from one focused workspace.
              </Typography>
            </Box>
            <Chip color="secondary" label="Mock mode" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
          </Toolbar>
        </AppBar>

        <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': { width: drawerWidth, border: 0 },
            }}
          >
            <Sidebar onClose={() => setMobileOpen(false)} />
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': { width: drawerWidth, border: 0 },
            }}
            open
          >
            <Sidebar />
          </Drawer>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: { md: `calc(100% - ${drawerWidth}px)` },
            pt: { xs: 15, sm: 13 },
            px: { xs: 2, sm: 3, lg: 4 },
            pb: 4,
          }}
        >
          <Stack spacing={3}>
            <Alert severity="info" icon={<AutoFixHighOutlinedIcon />}>
              {status}
            </Alert>

            <Paper sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={2}
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: { xs: 'stretch', lg: 'center' },
                  }}
                >
                  <Box>
                    <Typography variant="h2">Incident Input</Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      Paste logs or upload a ticket export to test the copilot workflow.
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
                    <Button
                      component="label"
                      variant="outlined"
                      startIcon={<CloudUploadOutlinedIcon />}
                    >
                      Upload Logs
                      <input hidden type="file" accept=".txt,.log,.json,.csv,.md" onChange={handleFileUpload} />
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<TroubleshootOutlinedIcon />}
                      onClick={() => handleAction('Incident analysis generated from mock intelligence')}
                    >
                      Analyze Incident
                    </Button>
                  </Stack>
                </Stack>

                {fileName && <Chip label={`Uploaded: ${fileName}`} sx={{ alignSelf: 'flex-start' }} />}
                <TextField
                  multiline
                  minRows={8}
                  value={incidentText}
                  onChange={(event) => setIncidentText(event.target.value)}
                  placeholder="Paste incident logs, alert payloads, customer reports, or ticket notes here."
                  fullWidth
                />
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                  <Button
                    variant="outlined"
                    startIcon={<FaPaperPlane />}
                    onClick={() => handleAction('Incident sent for mock processing')}
                  >
                    Send
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ArticleOutlinedIcon />}
                    onClick={() => handleAction('RCA report generated with mock findings')}
                  >
                    Generate RCA
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<PostAddOutlinedIcon />}
                    onClick={() => handleAction('JIRA ticket creation is ready for backend integration')}
                  >
                    Create JIRA Ticket
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                gap: 3,
              }}
            >
              <SectionCard title="Summarized Issue" icon={<ContentPasteSearchOutlinedIcon fontSize="small" />}>
                <TextField
                  value={summarizedIssue}
                  multiline
                  minRows={5}
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              </SectionCard>

              <SectionCard title="Suggested Resolution Steps" icon={<PlaylistAddCheckOutlinedIcon fontSize="small" />}>
                <Box component="ol" sx={{ m: 0, pl: 3 }}>
                  {resolutionSteps.map((step) => (
                    <Typography component="li" key={step} sx={{ mb: 1.2, pl: 0.5 }}>
                      {step}
                    </Typography>
                  ))}
                </Box>
              </SectionCard>

              <SectionCard title="RCA Report" icon={<FactCheckOutlinedIcon fontSize="small" />}>
                <TextField
                  value={rcaReport}
                  multiline
                  minRows={10}
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              </SectionCard>
            </Box>
          </Stack>
        </Box>
      </Box>
    </ThemeProvider>
  )
}
