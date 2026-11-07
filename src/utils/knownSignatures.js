// Hardware patterns for known surveillance devices, trackers, and IP camera chips
export const KNOWN_TRACKER_COMPANIES = [
  { id: '004c', name: 'Apple Find My / AirTag', companyId: 0x004c },
  { id: '0059', name: 'Nordic Semiconductor (IoT Camera/Tracker)', companyId: 0x0059 },
  { id: '0075', name: 'Samsung SmartTag', companyId: 0x0075 },
  { id: '0686', name: 'Tile Tracker', companyId: 0x0686 },
];

export const SUSPICIOUS_CAMERA_MAC_PREFIXES = [
  '00:1A:92', // Dresden Elektronik
  '00:23:63', // Foscam
  '00:62:6E', // Shenzhen Neo
  '00:80:F0', // Panasonic IP Camera
  '3C:33:00', // Hangzhou Hikvision
  'BC:5E:CD', // Dahua Technology
  '44:01:BB', // Tuya Smart Camera
  '70:B3:D5', // IEEE IoT Sensors
];

export const MANUAL_INSPECTION_CHECKLIST = [
  {
    id: 'smoke_detector',
    title: 'Smoke Detector & Sprinklers',
    desc: 'Inspect directly above the bed and bathroom. Check for pinpoint apertures or unexpected indicator lights.',
  },
  {
    id: 'alarm_clock',
    title: 'Alarm Clock / Docking Station',
    desc: 'Look behind front reflective panels using your flashlight to detect internal dual-lens assemblies.',
  },
  {
    id: 'wall_outlets',
    title: 'USB Chargers & Outlets',
    desc: 'Verify hollowed-out AC adapters plugged into walls facing living areas or beds.',
  },
  {
    id: 'mirrors',
    title: 'Two-Way Mirror Fingernail Test',
    desc: 'Place your fingernail flat against the glass. If there is NO gap between finger and reflection, it is a two-way mirror.',
  },
  {
    id: 'tv_soundbar',
    title: 'Smart TV Frame & Soundbars',
    desc: 'Check speaker grilles, HDMI hub slots, and screw recesses around TV mounts.',
  },
];
