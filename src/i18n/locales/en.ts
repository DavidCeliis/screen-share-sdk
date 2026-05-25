export const en = {
  // Share — trigger button
  'share.buttonIdle':        'Share screen',
  'share.buttonActive':      'Sharing…',

  // Share — modal titles
  'share.titleSetup':        'Share screen',
  'share.titleConnecting':   'Connecting…',
  'share.titleSharing':      'Sharing active',
  'share.titleP2P':          'Establishing P2P connection…',

  // Share — setup / preview area
  'share.waitingPermission': 'Waiting for sharing permission…',
  'share.clickToSelect':     'Click “Select screen” to continue',
  'share.permDenied':        'Screen sharing permission was denied',

  // Share — labels
  'share.agentCode':         'Agent code',

  // Share — status badges / text
  'share.badgeLive':         'LIVE',
  'share.badgePreview':      'PREVIEW',
  'share.screenBeingShared': 'Screen is being shared',

  // Share — buttons
  'share.selectScreen':      'Select screen',
  'share.connect':           'Connect',
  'share.switch':            'Switch',
  'share.stop':              'Stop',
  'share.tryAgain':          'Try again',

  // View — trigger button
  'view.buttonIdle':         'View screen',
  'view.buttonActive':       'Viewing…',

  // View — modal titles
  'view.titleIdle':          'View screen',
  'view.titleGenerating':    'Generating code…',
  'view.titleWaiting':       'Waiting for client…',
  'view.titleIncoming':      'Incoming screen',

  // View — waiting / code area
  'view.codeForClient':      'Code for the client',
  'view.copyCode':           'Copy code',
  'view.copied':             '✓ Copied',
  'view.waitingForClient':   'Waiting for client…',
  'view.p2pConnecting':      'Establishing P2P connection…',

  // View — placeholder
  'view.clickToStart':       'Click the button to start',

  // View — status
  'view.badgeLive':          'LIVE',
  'view.viewingScreen':      "Viewing client's screen",

  // View — buttons
  'view.generateCode':       'Generate code',
  'view.fullscreen':         'Fullscreen',
  'view.cancel':             'Cancel',
  'view.close':              'Close',
  'view.tryAgain':           'Try again',
  'view.stop':               'Stop',
  'view.failedToConnect':    'Failed to connect',
  'view.registrationFailed': 'Registration failed',

  // Toasts
  'toast.remoteDisconnect':  'The other side ended the connection',
  'toast.unexpectedError':   'Connection was unexpectedly interrupted',

  // Browser alert
  'alert.unsupportedBrowser':
    'Your browser does not support screen sharing.\n\nPlease use Chrome, Edge, or Firefox (current version) on a desktop device.',
} as const;

export type TranslationKey = keyof typeof en;
