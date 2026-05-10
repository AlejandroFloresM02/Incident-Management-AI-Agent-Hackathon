import { useRef, useState } from 'react'
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
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
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined'
import TroubleshootOutlinedIcon from '@mui/icons-material/TroubleshootOutlined'

import type { AgentResponse, Incident, Severity } from './types'

const drawerWidth = 264
const API_BASE = 'http://localhost:8000'

const sampleIncident = `INC-48291 | P1 | Checkout API latency spike
Service: payments-gateway
Window: 10:12-10:38 UTC
Symptoms: 38% increase in 5xx responses, p95 latency above 8s, queue depth rising.
Recent change: fraud scoring model rollout at 09:55 UTC.
Logs: upstream timeout from fraud-score-v3, circuit breaker opened, retry storm detected.`

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

function LoadingBlock({ label }: { label: string }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 3, px: 1 }}>
      <CircularProgress size={22} />
      <Typography color="text.secondary">{label}</Typography>
    </Stack>
  )
}

function buildIncident(text: string): Incident {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const title = lines[0]?.slice(0, 200) || 'Untitled incident'
  const severityMatch = text.match(/\bP[1-4]\b/)
  return {
    id: `INC-${Date.now()}`,
    title,
    description: text,
    severity: (severityMatch?.[0] as Severity | undefined) ?? 'P2',
    service: 'unknown',
    tags: [],
    created_at: new Date().toISOString(),
  }
}

function confidenceColor(c: number): 'error' | 'warning' | 'success' {
  if (c < 0.4) return 'error'
  if (c < 0.7) return 'warning'
  return 'success'
}

const severityChipSx: Record<Severity, { bgcolor: string; color: string }> = {
  P1: { bgcolor: '#dc2626', color: '#ffffff' },
  P2: { bgcolor: '#f59e0b', color: '#ffffff' },
  P3: { bgcolor: '#facc15', color: '#172033' },
  P4: { bgcolor: '#9ca3af', color: '#ffffff' },
}

const subcardSx = {
  border: '1px solid #e4e8f0',
  borderRadius: 1.5,
  p: 1.75,
  bgcolor: '#fafbfd',
} as const

const labelChipSx = {
  fontWeight: 700,
  bgcolor: '#e9f2ff',
  color: '#1f6feb',
  border: 0,
  height: 22,
} as const

function RCASection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={subcardSx}>
      <Chip label={label} size="small" sx={{ mb: 1, ...labelChipSx }} />
      {children}
    </Box>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {items.map((item, idx) => (
        <Typography
          component="li"
          variant="body2"
          key={idx}
          sx={{ mb: 0.5, lineHeight: 1.55 }}
        >
          {item}
        </Typography>
      ))}
    </Box>
  )
}

function TimelineList({ items }: { items: string[] }) {
  return (
    <Stack component="ul" spacing={0.85} sx={{ m: 0, pl: 0, listStyle: 'none' }}>
      {items.map((line, idx) => {
        const sep = line.indexOf(' - ')
        const ts = sep > 0 ? line.slice(0, sep) : null
        const rest = sep > 0 ? line.slice(sep + 3) : line
        return (
          <Stack
            key={idx}
            component="li"
            direction="row"
            spacing={1.25}
            sx={{ alignItems: 'flex-start' }}
          >
            {ts && (
              <Typography
                variant="caption"
                sx={{
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontWeight: 700,
                  color: '#1f6feb',
                  pt: 0.3,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {ts}
              </Typography>
            )}
            <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
              {rest}
            </Typography>
          </Stack>
        )
      })}
    </Stack>
  )
}

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [incidentText, setIncidentText] = useState(sampleIncident)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<AgentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const analyze = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setCancelled(false)
    try {
      const resp = await fetch(`${API_BASE}/api/incident/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildIncident(incidentText)),
        signal: controller.signal,
      })
      if (!resp.ok) {
        const body = await resp.text()
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 240)}`)
      }
      const data: AgentResponse = await resp.json()
      setResponse(data)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setResponse(null)
        setCancelled(true)
      } else {
        setResponse(null)
        setError(e instanceof Error ? e.message : 'unknown error')
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoading(false)
    }
  }

  const cancelAnalyze = () => {
    abortRef.current?.abort()
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setIncidentText(reader.result)
      }
    }
    reader.readAsText(file)
  }

  const summary = response?.summary ?? ''
  const steps = response?.suggested_steps ?? []

  const headerChip = loading ? (
    <Chip
      icon={<CircularProgress size={14} sx={{ ml: 0.5, color: 'inherit' }} />}
      label="Analyzing"
      sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
    />
  ) : error ? (
    <Chip
      color="error"
      label="Error"
      sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
    />
  ) : response ? (
    <Chip
      color={confidenceColor(response.confidence)}
      label={`Confidence ${response.confidence.toFixed(2)}`}
      sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
    />
  ) : (
    <Chip
      color="secondary"
      label="Idle"
      sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
    />
  )

  const statusAlert = error ? (
    <Alert severity="error" action={
      <Button color="inherit" size="small" onClick={analyze} disabled={loading}>
        Retry
      </Button>
    }>
      Agent error: {error}
    </Alert>
  ) : loading ? (
    <Alert severity="info" icon={<CircularProgress size={20} />}>
      Generating analysis... first call can take 30-60 s while Ollama warms up.
    </Alert>
  ) : cancelled ? (
    <Alert severity="warning" icon={<StopCircleOutlinedIcon />}>
      Analysis cancelled. Adjust the incident and Analyze again when ready.
    </Alert>
  ) : response ? (
    <Alert severity="success" icon={<AutoFixHighOutlinedIcon />}>
      Analysis complete - confidence {response.confidence.toFixed(2)}.
    </Alert>
  ) : (
    <Alert severity="info" icon={<AutoFixHighOutlinedIcon />}>
      Paste an incident below and click Analyze Incident to query the agent.
    </Alert>
  )

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
            {headerChip}
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
            {statusAlert}

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
                      disabled={loading}
                    >
                      Upload Logs
                      <input
                        hidden
                        type="file"
                        accept=".txt,.log,.json,.csv,.md"
                        onChange={handleFileUpload}
                      />
                    </Button>
                    {loading ? (
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<StopCircleOutlinedIcon />}
                        onClick={cancelAnalyze}
                      >
                        Stop Analysis
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        startIcon={<TroubleshootOutlinedIcon />}
                        onClick={analyze}
                        disabled={!incidentText.trim()}
                      >
                        Analyze Incident
                      </Button>
                    )}
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
                  disabled={loading}
                />
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                  <Button
                    variant="outlined"
                    startIcon={<ArticleOutlinedIcon />}
                    onClick={analyze}
                    disabled={loading || !incidentText.trim()}
                  >
                    Generate RCA
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<PostAddOutlinedIcon />}
                    disabled
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
                {loading ? (
                  <LoadingBlock label="Summarizing the incident..." />
                ) : summary ? (
                  <Box sx={subcardSx}>
                    <Typography
                      variant="body1"
                      sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
                    >
                      {summary}
                    </Typography>
                  </Box>
                ) : (
                  <Typography color="text.secondary">
                    Click Analyze Incident to generate a summary.
                  </Typography>
                )}
              </SectionCard>

              <SectionCard
                title="Similar Past Incidents"
                icon={<HistoryOutlinedIcon fontSize="small" />}
              >
                {loading ? (
                  <LoadingBlock label="Searching the historical knowledge base..." />
                ) : !response ? (
                  <Typography color="text.secondary">
                    Click Analyze Incident to retrieve similar past incidents.
                  </Typography>
                ) : response.similar_incidents.length === 0 ? (
                  <Typography color="text.secondary">
                    No similar incidents above the similarity threshold.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {response.similar_incidents.map((r) => (
                      <Box
                        key={r.incident.id}
                        sx={{
                          border: '1px solid #e4e8f0',
                          borderRadius: 1.5,
                          p: 1.5,
                          bgcolor: '#fafbfd',
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: 'center', mb: 0.75, flexWrap: 'wrap' }}
                        >
                          <Chip
                            size="small"
                            label={r.incident.severity}
                            sx={{ ...severityChipSx[r.incident.severity], fontWeight: 700 }}
                          />
                          <Chip
                            size="small"
                            color={confidenceColor(r.similarity)}
                            label={`${Math.round(r.similarity * 100)}% match`}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {r.incident.id} - {r.incident.service}
                          </Typography>
                        </Stack>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                          {r.incident.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {r.incident.description}
                        </Typography>
                        {r.incident.resolution && (
                          <Typography variant="body2">
                            <Box component="span" sx={{ fontWeight: 700 }}>
                              Resolution:
                            </Box>{' '}
                            {r.incident.resolution}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}
              </SectionCard>

              <SectionCard
                title="Suggested Resolution Steps"
                icon={<PlaylistAddCheckOutlinedIcon fontSize="small" />}
              >
                {loading ? (
                  <LoadingBlock label="Drafting suggested steps..." />
                ) : steps.length > 0 ? (
                  <Stack spacing={1.5}>
                    {steps.map((step, idx) => (
                      <Box key={`${idx}-${step}`} sx={subcardSx}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                          <Avatar
                            sx={{
                              width: 28,
                              height: 28,
                              bgcolor: '#1f6feb',
                              color: 'white',
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            {idx + 1}
                          </Avatar>
                          <Typography variant="body2" sx={{ pt: 0.4, lineHeight: 1.55 }}>
                            {step}
                          </Typography>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary">
                    Click Analyze Incident to generate suggested steps.
                  </Typography>
                )}
              </SectionCard>

              <SectionCard title="RCA Report" icon={<FactCheckOutlinedIcon fontSize="small" />}>
                {loading ? (
                  <LoadingBlock label="Building structured RCA..." />
                ) : !response ? (
                  <Typography color="text.secondary">
                    Click Analyze Incident to generate an RCA.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {response.rca.summary && (
                      <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                        {response.rca.summary}
                      </Typography>
                    )}
                    <RCASection label="Root cause">
                      <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                        {response.rca.root_cause}
                      </Typography>
                    </RCASection>
                    {response.rca.contributing_factors.length > 0 && (
                      <RCASection label="Contributing factors">
                        <BulletList items={response.rca.contributing_factors} />
                      </RCASection>
                    )}
                    {response.rca.timeline.length > 0 && (
                      <RCASection label="Timeline">
                        <TimelineList items={response.rca.timeline} />
                      </RCASection>
                    )}
                    {response.rca.preventive_actions.length > 0 && (
                      <RCASection label="Preventive actions">
                        <BulletList items={response.rca.preventive_actions} />
                      </RCASection>
                    )}
                  </Stack>
                )}
              </SectionCard>
            </Box>
          </Stack>
        </Box>
      </Box>
    </ThemeProvider>
  )
}
