import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, PermissionsAndroid, Platform, SafeAreaView,
  ScrollView, Share, StatusBar, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { BleManager, Device, State } from "react-native-ble-plx";

type Tab = "Home" | "Camera" | "Devices" | "Checklist" | "History" | "Guide" | "Settings";
type ScanRecord = {
  id: string; date: string; room: string; title: string; details: string;
  deviceCount?: number; checklistDone?: number; checklistTotal?: number;
};
type SavedDevice = { id: string; name: string; note: string; firstSeen: string; lastSeen: string };
type ChecklistItem = { id: string; label: string; hint: string };
const KEYS = { history: "sweep.history.v2", checklist: "sweep.checklist.v1", room: "sweep.room.v1", savedDevices: "sweep.devices.v1", onboarding: "sweep.onboarding.v1" };
const C = { bg: "#0B1017", panel: "#141D28", panel2: "#1D2937", text: "#F4F7FB", muted: "#9AA9BA", teal: "#5BE0C2", amber: "#F4C66A", red: "#F18C83", line: "#293747", green: "#8BD8A8" };
const manager = new BleManager();
const CHECKLIST: ChecklistItem[] = [
  { id: "alarms", label: "Inspect smoke detectors and alarms", hint: "Look for unfamiliar modifications, extra openings or objects that do not match the other units." },
  { id: "chargers", label: "Check clocks, chargers and USB adapters", hint: "Look for unfamiliar devices, tiny apertures or electronics that were not supplied with the room." },
  { id: "mirrors", label: "Inspect mirrors and reflective surfaces", hint: "Check that mirrors are securely mounted and appear consistent with the room. Reflection tests alone are not conclusive." },
  { id: "vents", label: "Inspect vents, shelves and decorations", hint: "Look for unusual objects, fresh alterations, wires or openings with a clear view of private areas." },
  { id: "private", label: "Check objects facing private areas", hint: "Pay attention to objects pointed toward beds, showers, changing areas or bathrooms." },
  { id: "power", label: "Look for unexpected cables and power sources", hint: "Trace unfamiliar cables where safe. Do not open electrical fixtures or touch exposed wiring." },
  { id: "wifi", label: "Review the room's Wi-Fi device list if available", hint: "Use the router or network-owner app. Device names and MAC addresses do not prove a device is a camera." },
  { id: "tracker", label: "Check your phone's unknown-tracker alerts", hint: "Use the built-in tracker safety feature on your phone; Sweep cannot invoke Apple's private Find My scan." }
];

function shortId(id: string) { return id.length > 14 ? id.slice(0, 6) + "…" + id.slice(-5) : id; }
function dateLabel(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleString(); }

export default function App() {
  const [tab, setTab] = useState<Tab>("Home");
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanSeconds, setScanSeconds] = useState(0);
  const [bleState, setBleState] = useState<State>(State.Unknown);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [room, setRoom] = useState("Current room");
  const [savedDevices, setSavedDevices] = useState<SavedDevice[]>([]);
  const [showTips, setShowTips] = useState(true);
  const [ready, setReady] = useState(false);
  const scanTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanStartedAt = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    Promise.all([
      AsyncStorage.getItem(KEYS.history), AsyncStorage.getItem(KEYS.checklist),
      AsyncStorage.getItem(KEYS.room), AsyncStorage.getItem(KEYS.savedDevices)
    ]).then(([h, c, r, s]) => {
      if (!alive) return;
      try { if (h) setHistory(JSON.parse(h)); } catch {}
      try { if (c) setChecked(JSON.parse(c)); } catch {}
      try { if (r) setRoom(r); } catch {}
      try { if (s) setSavedDevices(JSON.parse(s)); } catch {}
      setReady(true);
    }).catch(() => setReady(true));
    const sub = manager.onStateChange(s => setBleState(s), true);
    return () => {
      alive = false;
      sub.remove();
      manager.stopDeviceScan();
      if (scanTimer.current) clearInterval(scanTimer.current);
      if (scanEndTimer.current) clearTimeout(scanEndTimer.current);
    };
  }, []);

  const persist = async (key: string, value: unknown) => {
    try { await AsyncStorage.setItem(key, JSON.stringify(value)); }
    catch { Alert.alert("Could not save", "Check available storage on your device and try again."); }
  };
  const saveRecord = async (title: string, details: string, extra: Partial<ScanRecord> = {}) => {
    const record: ScanRecord = { id: String(Date.now()), date: new Date().toISOString(), room: room.trim() || "Unnamed room", title, details, ...extra };
    const next = [record, ...history].slice(0, 100);
    setHistory(next);
    await persist(KEYS.history, next);
  };
  const stopBleScan = () => {
    manager.stopDeviceScan();
    setScanning(false);
    if (scanTimer.current) clearInterval(scanTimer.current);
    if (scanEndTimer.current) clearTimeout(scanEndTimer.current);
    scanTimer.current = null;
    scanEndTimer.current = null;
  };
  const startBleScan = async () => {
    if (scanning) { stopBleScan(); return; }
    if (bleState !== State.PoweredOn) {
      Alert.alert("Bluetooth is unavailable", "Turn on Bluetooth, allow Sweep to use nearby devices, and try again.");
      return;
    }
    if (Platform.OS === "android") {
      const permissions = Number(Platform.Version) >= 31
        ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const results = await PermissionsAndroid.requestMultiple(permissions);
      if (Object.values(results).some(v => v !== PermissionsAndroid.RESULTS.GRANTED)) {
        Alert.alert("Permission needed", "Sweep needs the requested Android permission to scan nearby Bluetooth advertisements.");
        return;
      }
    }
    setDevices([]);
    setScanSeconds(15);
    scanStartedAt.current = Date.now();
    setScanning(true);
    try {
      manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          stopBleScan();
          Alert.alert("Bluetooth scan stopped", error.message);
          return;
        }
        if (device) setDevices(old => old.some(d => d.id === device.id) ? old : [...old, device]);
      });
      scanTimer.current = setInterval(() => setScanSeconds(Math.max(0, 15 - Math.floor((Date.now() - scanStartedAt.current) / 1000))), 500);
      scanEndTimer.current = setTimeout(async () => {
        manager.stopDeviceScan();
        setScanning(false);
        if (scanTimer.current) clearInterval(scanTimer.current);
        scanTimer.current = null;
        scanEndTimer.current = null;
        setScanSeconds(0);
      }, 15000);
    } catch (e) {
      stopBleScan();
      Alert.alert("Could not start scan", e instanceof Error ? e.message : "Please try again.");
    }
  };

  const saveBluetoothSession = async () => {
    const lines = devices.map(d => `${d.name || "Unnamed BLE signal"} (${shortId(d.id)}), RSSI ${d.rssi ?? "unknown"} dBm`);
    await saveRecord("Bluetooth scan", `${devices.length} Bluetooth advertisement(s) seen. These are not confirmed trackers or cameras.${lines.length ? "\n" + lines.join("\n") : ""}`, { deviceCount: devices.length });
    Alert.alert("Saved", "The Bluetooth scan summary was added to local history.");
  };
  const markDevice = async (device: Device) => {
    const existing = savedDevices.find(x => x.id === device.id);
    const next: SavedDevice[] = existing
      ? savedDevices.filter(x => x.id !== device.id)
      : [{ id: device.id, name: device.name || device.localName || "Unnamed BLE device", note: "Marked for your review", firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString() }, ...savedDevices];
    setSavedDevices(next);
    await persist(KEYS.savedDevices, next);
  };
  const toggleItem = (id: string) => {
    const next = checked.includes(id) ? checked.filter(x => x !== id) : [...checked, id];
    setChecked(next);
    persist(KEYS.checklist, next);
  };
  const saveChecklist = async () => {
    await saveRecord("Physical inspection checklist", `${checked.length} of ${CHECKLIST.length} items checked.`, { checklistDone: checked.length, checklistTotal: CHECKLIST.length });
    Alert.alert("Progress saved", "Your checklist progress was saved to this device.");
  };
  const finishCameraCheck = async () => {
    await saveRecord("Visual camera inspection", "Camera preview was opened for a manual visual inspection. No automated lens, infrared or camera detection was performed.");
    Alert.alert("Inspection saved", "Your manual inspection note was saved. Sweep did not automatically detect or rule out a camera.");
  };
  const clearHistory = () => Alert.alert("Clear inspection history?", "This permanently deletes saved inspection records from this phone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Clear history", style: "destructive", onPress: async () => { setHistory([]); await AsyncStorage.removeItem(KEYS.history); } }
  ]);
  const exportHistory = async () => {
    const content = ["SWEEP INSPECTION HISTORY", "", ...history.map(h => `${dateLabel(h.date)} | ${h.room} | ${h.title}\n${h.details}\n`)].join("\n");
    try { await Share.share({ title: "Sweep inspection history", message: content || "No inspection history." }); }
    catch { Alert.alert("Export unavailable", "Your device could not open the share sheet."); }
  };
  const updateRoom = (v: string) => { setRoom(v); AsyncStorage.setItem(KEYS.room, v).catch(() => {}); };

  const Card = ({ children }: { children: React.ReactNode }) => <View style={styles.card}>{children}</View>;
  const Action = ({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) =>
    <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.action, secondary && styles.secondary, disabled && { opacity: 0.45 }]}><Text style={[styles.actionText, secondary && { color: C.text }]}>{label}</Text></TouchableOpacity>;
  const Header = ({ title, subtitle }: { title: string; subtitle: string }) =>
    <View style={styles.header}><Text style={styles.brand}>SWEEP <Text style={{ color: C.teal }}>●</Text></Text><Text style={styles.heading}>{title}</Text><Text style={styles.muted}>{subtitle}</Text></View>;

  const renderHome = () => <ScrollView contentContainerStyle={styles.content}>
    <Header title="Room privacy check" subtitle="A practical inspection companion for unfamiliar spaces." />
    <Card>
      <Text style={styles.eyebrow}>CURRENT INSPECTION</Text>
      <TextInput value={room} onChangeText={updateRoom} placeholder="Name this room" placeholderTextColor={C.muted} style={styles.roomInput} accessibilityLabel="Room name" />
      <Text style={styles.cardTitle}>Run a room sweep</Text>
      <Text style={styles.body}>Complete the visual, Bluetooth and physical inspection steps. Sweep keeps your notes on this device.</Text>
      <Action label="Start visual inspection  →" onPress={() => setTab("Camera")} />
      <Action label="Scan nearby Bluetooth" secondary onPress={() => setTab("Devices")} />
      <Action label="Open physical checklist" secondary onPress={() => setTab("Checklist")} />
    </Card>
    <View style={styles.stats}>
      <View style={styles.stat}><Text style={styles.statNumber}>{devices.length}</Text><Text style={styles.muted}>BLE signals</Text></View>
      <View style={styles.stat}><Text style={styles.statNumber}>{checked.length}/{CHECKLIST.length}</Text><Text style={styles.muted}>Checklist</Text></View>
      <View style={styles.stat}><Text style={styles.statNumber}>{history.length}</Text><Text style={styles.muted}>Saved checks</Text></View>
    </View>
    <Card><Text style={styles.cardTitle}>A note about results</Text><Text style={styles.body}>A quiet scan does not mean a room is clear. Phones cannot reliably detect every hidden camera, passive transmitter or hardwired device. Use Sweep as one part of a careful inspection.</Text></Card>
    <Action label="Read detection guide" secondary onPress={() => setTab("Guide")} />
  </ScrollView>;

  const renderCamera = () => <ScrollView contentContainerStyle={styles.content}>
    <Header title="Visual inspection" subtitle="Use the camera preview and flashlight while examining objects." />
    {!permission?.granted
      ? <Card><Text style={styles.cardTitle}>Camera permission</Text><Text style={styles.body}>Sweep needs camera access to display a live preview. Video is not recorded or uploaded by this screen.</Text><Action label="Allow camera access" onPress={requestPermission} /></Card>
      : <>
        <View style={styles.cameraFrame}>
          <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setCameraReady(true)} />
          <View style={styles.cameraTag}><Text style={styles.cameraTagText}>{cameraReady ? "LIVE PREVIEW" : "STARTING CAMERA…"}</Text></View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}><Action label={torch ? "Flashlight off" : "Flashlight on"} secondary onPress={() => setTorch(v => !v)} /></View>
          <View style={styles.flex}><Action label="Save inspection" onPress={finishCameraCheck} /></View>
        </View>
      </>}
    <Card><Text style={styles.cardTitle}>Manual inspection tips</Text><Text style={styles.body}>• Sweep the flashlight slowly across suspicious surfaces from different angles.{"\n"}• Look for small glass-like lens openings in objects with a view of private areas.{"\n"}• Compare unusual objects with similar fixtures elsewhere in the room.{"\n"}• Do not dismantle electrical fixtures or touch exposed wiring.</Text></Card>
    <Card><Text style={styles.note}>This build does not analyze camera frames, identify lens glints or detect infrared LEDs. Phone cameras vary, and IR filters can prevent reliable detection.</Text></Card>
  </ScrollView>;

  const renderDevices = () => <ScrollView contentContainerStyle={styles.content}>
    <Header title="Nearby Bluetooth" subtitle="A short scan of Bluetooth Low Energy advertisements." />
    <Card>
      <Text style={styles.cardTitle}>Bluetooth status</Text>
      <Text style={styles.body}>{bleState === State.PoweredOn ? "Bluetooth is on and ready." : bleState === State.PoweredOff ? "Bluetooth is turned off." : bleState === State.Unauthorized ? "Bluetooth permission is not authorized." : "Bluetooth status: " + bleState}</Text>
      <Action label={scanning ? `Stop scan (${scanSeconds}s)` : "Scan for 15 seconds"} onPress={startBleScan} />
      {scanning && <ActivityIndicator color={C.teal} style={{ marginTop: 8 }} />}
      {!scanning && devices.length > 0 && <Action label="Save scan to history" secondary onPress={saveBluetoothSession} />}
    </Card>
    {devices.map(d => {
      const marked = savedDevices.some(x => x.id === d.id);
      return <Card key={d.id}>
        <View style={styles.deviceHeader}><Text style={styles.deviceName}>{d.name || d.localName || "Unnamed BLE signal"}</Text><Text style={styles.signal}>{d.rssi == null ? "—" : d.rssi + " dBm"}</Text></View>
        <Text style={styles.muted}>Identifier: {shortId(d.id)}</Text>
        {!!d.serviceUUIDs?.length && <Text style={styles.muted}>Advertised services: {d.serviceUUIDs.slice(0, 3).join(", ")}</Text>}
        <Text style={styles.note}>Unclassified signal · not confirmed as a tracker or camera</Text>
        <Action label={marked ? "Remove review marker" : "Mark for review"} secondary onPress={() => markDevice(d)} />
      </Card>;
    })}
    {!devices.length && <Card><Text style={styles.body}>{scanning ? "Listening for nearby Bluetooth advertisements…" : "No Bluetooth signals have been collected in this session."}</Text></Card>}
    <Card><Text style={styles.note}>Nearby Bluetooth devices are not proof of surveillance. Phones, watches, headphones and smart-home products may appear. Some trackers may not advertise during a short scan. Use your phone's built-in unknown-tracker alerts too.</Text></Card>
  </ScrollView>;

  const renderChecklist = () => <ScrollView contentContainerStyle={styles.content}>
    <Header title="Physical checklist" subtitle="A methodical visual check is one of the most useful steps." />
    <Card>
      <View style={styles.deviceHeader}><Text style={styles.cardTitle}>Inspection progress</Text><Text style={styles.signal}>{checked.length}/{CHECKLIST.length}</Text></View>
      <View style={styles.progress}><View style={[styles.progressFill, { width: (checked.length / CHECKLIST.length * 100) + "%" }]} /></View>
      {CHECKLIST.map(item => <View key={item.id} style={styles.checkItem}>
        <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: checked.includes(item.id) }} style={styles.checkRow} onPress={() => toggleItem(item.id)}>
          <View style={[styles.checkBox, checked.includes(item.id) && styles.checkBoxDone]}><Text style={styles.checkMark}>{checked.includes(item.id) ? "✓" : ""}</Text></View>
          <Text style={[styles.body, styles.checkLabel, checked.includes(item.id) && styles.doneText]}>{item.label}</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>{item.hint}</Text>
      </View>)}
      <Action label="Save checklist progress" onPress={saveChecklist} />
      <Action label="Reset checklist" secondary onPress={() => Alert.alert("Reset checklist?", "This clears all checkmarks for the current device.", [{ text: "Cancel", style: "cancel" }, { text: "Reset", style: "destructive", onPress: () => { setChecked([]); persist(KEYS.checklist, []); } }])} />
    </Card>
  </ScrollView>;

  const renderHistory = () => <ScrollView contentContainerStyle={styles.content}>
    <Header title="Inspection history" subtitle="Your saved room checks, stored locally." />
    {history.length > 0 ? <>
      <View style={styles.row}><View style={styles.flex}><Action label="Share / export" secondary onPress={exportHistory} /></View><View style={styles.flex}><Action label="Clear history" secondary onPress={clearHistory} /></View></View>
      {history.map(item => <Card key={item.id}>
        <Text style={styles.eyebrow}>{item.room}</Text><Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.muted}>{dateLabel(item.date)}</Text><Text style={styles.body}>{item.details}</Text>
      </Card>)}
    </> : <Card><Text style={styles.cardTitle}>No saved inspections yet</Text><Text style={styles.body}>Your camera notes, Bluetooth summaries and checklist progress will appear here after you save them.</Text></Card>}
    <Text style={styles.note}>History remains on this device unless you choose to share/export it. Deleting the app may remove local records.</Text>
  </ScrollView>;

  const renderGuide = () => <ScrollView contentContainerStyle={styles.content}>
    <Header title="Detection guide" subtitle="Understand what Sweep can and cannot check." />
    <Card><Text style={styles.cardTitle}>Camera and infrared clues</Text><Text style={styles.body}>A phone camera can help you inspect objects visually, but it is not a calibrated infrared detector. Many phone cameras filter infrared light; some emitters are invisible to the camera. Lens-reflection tricks can produce false positives and false negatives.</Text></Card>
    <Card><Text style={styles.cardTitle}>Bluetooth and trackers</Text><Text style={styles.body}>Sweep can list BLE advertisements visible to your phone. It cannot prove that a signal is an AirTag or other tracker from its name or signal strength. For unwanted tracker safety, use the built-in alerts and manual scan tools provided by iOS or Android.</Text></Card>
    <Card><Text style={styles.cardTitle}>Wi-Fi and network devices</Text><Text style={styles.body}>iOS does not let ordinary third-party apps enumerate every device on a local Wi-Fi network. Android network discovery needs additional native implementation and permissions; it is not included in this release.</Text></Card>
    <Card><Text style={styles.cardTitle}>What Sweep cannot guarantee</Text><Text style={styles.body}>No phone-only inspection can guarantee detection of hardwired cameras, powered-off devices, passive RF equipment, devices outside radio range or equipment designed to evade discovery. If you find a suspicious object, avoid tampering with it; document it and contact the property owner or appropriate authorities if needed.</Text></Card>
  </ScrollView>;

  const renderSettings = () => <ScrollView contentContainerStyle={styles.content}>
    <Header title="Settings & privacy" subtitle="Control what Sweep stores on this device." />
    <Card><Text style={styles.cardTitle}>Local storage</Text><Text style={styles.body}>Room name, checklist progress, review markers and inspection history are stored locally using device storage. This app build does not include a Sweep account or cloud sync.</Text></Card>
    <Card><Text style={styles.cardTitle}>Permissions</Text><Text style={styles.body}>Camera is used for the live preview. Bluetooth is used to scan nearby BLE advertisements. You can change permissions in your phone's system settings.</Text><Action label="Open app settings" onPress={() => Linking.openSettings()} secondary /></Card>
    <Card><Text style={styles.cardTitle}>App information</Text><Text style={styles.body}>Sweep · Version 1.0.0 MVP{"\n"}Inspection assistance only. Not a certified security detector.</Text><Action label="Read detection limitations" secondary onPress={() => setTab("Guide")} /></Card>
  </ScrollView>;

  const screens: Record<Tab, () => React.ReactNode> = {
    Home: renderHome, Camera: renderCamera, Devices: renderDevices, Checklist: renderChecklist,
    History: renderHistory, Guide: renderGuide, Settings: renderSettings
  };
  const nav: Tab[] = ["Home", "Camera", "Devices", "Checklist", "History"];
  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="light-content" backgroundColor={C.bg} />
    <View style={styles.main}>{ready ? screens[tab]() : <View style={styles.loading}><ActivityIndicator color={C.teal} /><Text style={styles.muted}>Loading your local inspection data…</Text></View>}</View>
    <View style={styles.nav}>
      {nav.map(t => <TouchableOpacity key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)} style={styles.navItem}><Text style={[styles.navText, tab === t && styles.navActive]}>{t}</Text></TouchableOpacity>)}
      <TouchableOpacity accessibilityRole="button" onPress={() => setTab(tab === "Settings" ? "Home" : "Settings")} style={styles.navItem}><Text style={[styles.navText, tab === "Settings" && styles.navActive]}>More</Text></TouchableOpacity>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, main: { flex: 1 }, content: { padding: 20, paddingBottom: 30, gap: 14 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  header: { paddingTop: 12, paddingBottom: 8 }, brand: { color: C.text, fontSize: 13, fontWeight: "900", letterSpacing: 3, marginBottom: 22 },
  heading: { color: C.text, fontSize: 29, fontWeight: "800", letterSpacing: -0.7 }, muted: { color: C.muted, fontSize: 13, marginTop: 6, lineHeight: 19 },
  eyebrow: { color: C.teal, fontSize: 10, fontWeight: "800", letterSpacing: 2 }, card: { backgroundColor: C.panel, borderRadius: 18, padding: 17, borderWidth: 1, borderColor: C.line, gap: 11 },
  cardTitle: { color: C.text, fontSize: 18, fontWeight: "750" }, body: { color: "#D0D8E3", fontSize: 14, lineHeight: 21 }, note: { color: C.amber, fontSize: 12, lineHeight: 18 },
  hint: { color: C.muted, fontSize: 12, lineHeight: 18, marginLeft: 35, marginBottom: 7 }, roomInput: { backgroundColor: C.panel2, borderRadius: 10, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 15 },
  action: { backgroundColor: C.teal, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 15, alignItems: "center", justifyContent: "center", minHeight: 44 },
  secondary: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line }, actionText: { color: "#09221D", fontWeight: "800", fontSize: 13 },
  stats: { flexDirection: "row", gap: 9 }, stat: { flex: 1, backgroundColor: C.panel, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line },
  statNumber: { color: C.text, fontSize: 23, fontWeight: "800" }, cameraFrame: { height: 390, backgroundColor: "#05070A", borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: C.line },
  cameraTag: { position: "absolute", top: 12, left: 12, backgroundColor: "#0009", padding: 8, borderRadius: 8 }, cameraTagText: { color: C.teal, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  row: { flexDirection: "row", gap: 10 }, flex: { flex: 1 }, deviceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  deviceName: { color: C.text, fontWeight: "700", fontSize: 15, flex: 1 }, signal: { color: C.teal, fontWeight: "800", fontSize: 12 },
  progress: { height: 6, backgroundColor: C.panel2, borderRadius: 4, overflow: "hidden" }, progressFill: { height: 6, backgroundColor: C.teal },
  checkItem: { borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 7 }, checkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  checkLabel: { flex: 1 }, checkBox: { width: 23, height: 23, borderRadius: 7, borderWidth: 1, borderColor: C.muted, alignItems: "center", justifyContent: "center" },
  checkBoxDone: { backgroundColor: C.teal, borderColor: C.teal }, checkMark: { color: "#09221D", fontWeight: "900" }, doneText: { color: C.muted, textDecorationLine: "line-through" },
  nav: { flexDirection: "row", backgroundColor: C.panel, borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 11, paddingHorizontal: 3 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center" }, navText: { color: C.muted, fontSize: 10, fontWeight: "700" }, navActive: { color: C.teal }
});