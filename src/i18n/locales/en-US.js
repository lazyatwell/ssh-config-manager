// English locale. All user-visible copy lives here; never hardcode strings in components.
// When adding a key, update zh-CN.js as well — the two files must stay structurally identical.
export default {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    ok: 'OK',
    alertTitle: 'Notice',
    loading: 'Loading...',
    processing: 'Processing...',
    retry: 'Retry',
    expand: 'Expand',
    collapse: 'Collapse'
  },

  app: {
    subtitle: 'Manage your local SSH configurations easily',
    switchLanguage: 'Switch language',
    newHost: 'New Host',
    searchPlaceholder: 'Search hosts by alias, IP, or user...',
    clearSearch: 'Clear search',
    loadingConfigs: 'Loading configurations...',
    noHosts: 'No hosts found',
    noHostsHint: 'Try adjusting your search or add a new host.',
    apiUnavailable: 'SSH API not available (Are you running in Electron?)',
    sshConnect: 'SSH Connect',
    edit: 'Edit',
    copy: 'Duplicate',
    delete: 'Delete',
    moreActions: 'More actions',
    shareStatus: 'Share status',
    fields: {
      hostName: 'HostName',
      user: 'User',
      port: 'Port',
      identity: 'Identity'
    },
    deleteConfirmTitle: 'Delete Confirmation',
    deleteConfirmMessage: 'Are you sure you want to delete "{name}"?',
    copyConfirmTitle: 'Duplicate Confirmation',
    copyConfirmMessage: 'Are you sure you want to duplicate "{name}"?',
    saveFailed: 'Save Failed',
    deleteFailed: 'Delete Failed',
    copyFailed: 'Duplicate Failed',
    connectFailed: 'Connection Failed',
    connectFailedMessage: 'Could not open SSH connection: {detail}',
    importSuccessTitle: 'Import Successful',
    importSuccessMessage: 'Node "{name}" imported successfully'
  },

  update: {
    available: 'New version {version} is available!',
    downloading: 'Downloading update... {percent}%',
    downloaded: 'Update downloaded. Restart the app to install.',
    download: 'Download',
    restartNow: 'Restart Now',
    later: 'Remind me later'
  },

  hostEditor: {
    titleNew: 'New Host',
    titleEdit: 'Edit Host',
    labels: {
      host: 'Host (Alias)',
      hostName: 'HostName (IP/Domain)',
      user: 'User',
      port: 'Port',
      identityFile: 'IdentityFile (Key Path)',
      password: 'Password',
      remark: 'Remark'
    },
    placeholders: {
      host: 'myserver',
      hostName: '192.168.1.1',
      user: 'root',
      userDefault: 'root (default)',
      port: '22',
      portDefault: '22 (default)',
      password: 'Only used by Copy ID to install the key',
      remark: 'e.g. Production primary server'
    },
    noKeyOption: 'No key',
    generateKey: 'Generate',
    generating: 'Generating...',
    keygenFailed: 'Key generation failed: {msg}',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    passwordHint: 'Used only once by Copy ID to install the public key on the remote host; never saved to the config file',
    copyId: 'Copy ID',
    copying: 'Copying...',
    copyIdHint: 'User, IdentityFile and Password are required',
    copyIdFailed: 'Copy ID failed: {msg}',
    apiUnavailable: 'SSH API not available (Are you running in Electron?)',
    validation: {
      hostRequired: 'Host is required',
      hostTooLong: 'Host must be at most 50 characters',
      hostNoSpaces: 'Host cannot contain spaces; use - instead',
      hostNoWildcards: 'Host alias cannot contain wildcard characters * ? !',
      hostNameRequired: 'HostName is required',
      hostNameTooLong: 'HostName must be at most 50 characters',
      hostNameInvalid: 'HostName must be a valid IP or domain',
      userRequired: 'User is required',
      userTooLong: 'User must be at most 50 characters',
      portInvalid: 'Port must be a number',
      portRange: 'Port must be between 1 and 65535',
      identityTooLong: 'IdentityFile must be at most 255 characters',
      remarkTooLong: 'Remark must be at most 255 characters',
      passwordRequired: 'Password is required for Copy ID'
    }
  },

  network: {
    title: 'LAN Sharing',
    enabled: 'Enabled',
    disabled: 'Disabled',
    devicesOnline: '{n} device(s) online',
    refreshDiscovery: 'Refresh discovery',
    turnOn: 'Enable',
    turnOff: 'Disable',
    discoveredDevices: 'Discovered Devices',
    onlineCount: '{n} online',
    noDevices: 'No other devices found',
    noDevicesHint: 'Make sure sharing is enabled on the other devices too',
    nodeCount: '{n} node(s)',
    summary: 'Found {devices} device(s) sharing {nodes} node(s)',
    viewDetails: 'View details',
    statusFailed: 'Failed to get network status',
    peersFailed: 'Failed to get device list',
    toggleFailed: 'Failed to toggle sharing',
    refreshFailed: 'Failed to refresh discovery'
  },

  localShared: {
    title: 'Shared by This Device',
    count: '{n}',
    empty: 'No shared nodes yet',
    emptyHint: 'Click the share button on a host card to start sharing',
    sharing: 'Sharing',
    expandAll: 'Show all ({n})'
  },

  remoteNode: {
    loading: 'Loading nodes...',
    fetchFailed: 'Failed to fetch nodes',
    empty: 'This device has not shared any nodes',
    importing: 'Importing',
    add: 'Add',
    refreshList: 'Refresh node list',
    importFailed: 'Failed to import node: {detail}'
  },

  share: {
    share: 'Share to LAN',
    unshare: 'Stop sharing to LAN'
  },

  // Error-code map for failures returned by the main process over IPC
  errors: {
    unknown: 'Unknown error',
    generic: '{detail}',
    pubkeyNotFound: 'Public key file {path} not found. Check the IdentityFile path, or generate a key with ssh-keygen first',
    noDefaultPubkey: 'No default public key found (id_ed25519.pub / id_ecdsa.pub / id_rsa.pub under ~/.ssh). Generate one with ssh-keygen, or set a private key path in IdentityFile',
    pubkeyReadFailed: 'Failed to read public key file: {detail}',
    pubkeyInvalid: 'Invalid public key file format: {path}',
    dnsFailed: 'Cannot resolve host {host}: check that HostName is correct',
    authFailed: 'Authentication failed: wrong username or password',
    connRefused: 'Connection refused: check the port and that sshd is running on the remote host',
    connTimeout: 'Connection timed out: host unreachable or port blocked',
    hostUnreachable: 'Cannot resolve or reach the host: check that HostName is correct',
    connLost: 'Connection failed: host unreachable or connection dropped. Check HostName, Port and the network',
    remoteWriteFailed: 'Failed to write authorized_keys on the remote host: {detail}',
    remoteExecFailed: 'Remote command execution failed: {detail}',
    mkdirFailed: 'Failed to create the ~/.ssh directory: {detail}',
    keyExists: 'Default key files (id_ed25519 / id_rsa) already exist; please resolve manually first',
    keygenNotFound: 'ssh-keygen command not found. Make sure the OpenSSH client is installed',
    keygenFailed: 'ssh-keygen failed: {detail}',
    noTerminalFound: 'No suitable terminal application found'
  }
}
