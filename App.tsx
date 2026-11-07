import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, PermissionsAndroid, Platform, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { BleManager, Device, State } from "react-native-ble-plx";

type Tab = "Home" | "Camera" | "Devices" | "Checklist" | "History";
type ScanRecord = { id: string; date: string; title: string; details: string };

const C = { bg: "#0D1118", panel: "#171E29", panel2: "#202A38", text: "#F4F7FB", muted: "#9AA8BA", teal: "#57E0C1", amber: "#F6C66A", line: "#2A3544" };
const manager = new BleManager();

export default function App() {
  const [tab, setTab] = useState<Tab>("Home");
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [bleState, setBleState] = useState<State>(State.Unknown);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const camera = useRef<CameraView>(null);

  useEffect(() => {
    AsyncStorage.getItem("sweep.history").then(v => { if (v) setHistory(JSON.parse(v)); }).catch(() => {});
    const sub = manager.onStateChange(s => setBleState(s), true);
    return () => { sub.remove(); manager.stopDeviceScan(); };
  }, []);

  const saveRecord = async (title: string, details: string) => {
    const record = { id: String(Date.now()), date: new Date().toISOString(), title, details };
    const next = [record, ...history].slice(0, 50);
    setHistory(next);
    await AsyncStorage.setItem("sweep.history", JSON.stringify(next));
  };

  const startBleScan = async () => {
    if (scanning) { manager.stopDeviceScan(); setScanning(false); return; }
    if (Platform.OS === "android" && Number(Platform.Version) >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      ]);
      if (Object.values(result).some(v => v !== PermissionsAndroid.RESULTS.GRANTED)) {
        Alert.alert("Permission needed", "Allow Nearby devices access to scan Bluetooth advertisements.");
        return;
      }
    } else if (Platform.OS === "android") {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    if (bleState !== State.PoweredOn) {
      Alert.alert("Bluetooth unavailable", "Turn on Bluetooth and try again.");
      return;
    }
    setDevices([]);
    setScanning(true);
    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        setScanning(false);
        Alert.alert("Scan stopped", error.message);
        return;
      }
      if (device) setDevices(old => old.some(d => d.id === device.id) ? old : [...old, device]);
    });
    setTimeout(() => { manager.stopDeviceScan(); setScanning(false); }, 15000);
  };

  const finishCameraCheck = async () => {
    await saveRecord("Visual room check", "Camera preview opened. No automated lens or infrared analysis was performed.");
    Alert.alert("Check saved", "Your visual inspection was saved. Sweep has not automatically detected or ruled out a camera.");
  };

  const toggleItem = (item: string) => setChecked(old => old.includes(item) ? old.filter(x => x !== item) : [...old, item]);
  const checklist = ["Inspect smoke detectors and alarms", "Check clocks, chargers and USB adapters", "Look closely at mirrors and reflective objects", "Inspect vents, shelves and decorative objects", "Check objects facing beds, showers and changing areas", "Review unfamiliar devices on the Wi-Fi router"];
  const Card = ({ children }: { children: React.ReactNode }) => <View style={styles.card}>{children}</View>;
  const Action = ({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) =>
    <TouchableOpacity onPress={onPress} style={[styles.action, secondary && styles.secondary]}><Text style={[styles.actionText, secondary && { color: C.text }]}>{label}</Text></TouchableOpacity>;

  const Header = ({ title, subtitle }: { title: string; subtitle: string }) =>
    <View style={styles.header}><Text style={styles.brand}>SWEEP <Text style={{ color: C.teal }}>●</Text></Text><Text style={styles.heading}>{title}</Text><Text style={styles.muted}>{subtitle}</Text></View>;

  const renderHome = () => <ScrollView contentContainerStyle={styles.content}>
    <Header title="Room privacy check" subtitle="A practical inspection assistant for unfamiliar spaces." />
    <Card><Text style={styles.eyebrow}>START HERE</Text><Text style={styles.cardTitle}>Run a room sweep</Text><Text style={styles.body}>Work through the camera, Bluetooth and physical inspection steps. Each check explains what it can and cannot tell you.</Text><Action label="Start camera inspection  →" onPress={() => setTab("Camera")} /><Action label="Scan nearby Bluetooth devices" secondary onPress={() => setTab("Devices")} /></Card>
    <View style={styles.stats}><View style={styles.stat}><Text style={styles.statNumber}>{devices.length}</Text><Text style={styles.muted}>Devices seen</Text></View><View style={styles.stat}><Text style={styles.statNumber}>{checked.length}/{checklist.length}</Text><Text style={styles.muted}>Checklist</Text></View><View style={styles.stat}><Text style={styles.statNumber}>{history.length}</Text><Text style={styles.muted}>Saved checks</Text></View></View>
    <Card><Text style={styles.cardTitle}>Important limitation</Text><Text style={styles.body}>No phone app can guarantee a room is free of hidden cameras or listening devices. Sweep provides clues and inspection steps—not a security certification.</Text></Card>
  </ScrollView>;

  const renderCamera = () => <ScrollView contentContainerStyle={styles.content}>
    <Header title="Camera inspection" subtitle="Use your phone camera and flashlight to inspect suspicious objects." />
    {!permission?.granted ? <Card><Text style={styles.cardTitle}>Camera permission</Text><Text style={styles.body}>Camera access is needed to show the live preview.</Text><Action label="Allow camera" onPress={requestPermission} /></Card> :
    <><View style={styles.cameraFrame}><CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setCameraReady(true)} /><View style={styles.cameraTag}><Text style={styles.cameraTagText}>{cameraReady ? "LIVE CAMERA" : "STARTING CAMERA…"}</Text></View></View>
    <View style={styles.row}><Action label={torch ? "Turn flashlight off" : "Turn flashlight on"} secondary onPress={() => setTorch(!torch)} /><Action label="Save check" onPress={finishCameraCheck} /></View></>}
    <Card><Text style={styles.cardTitle}>What to look for</Text><Text style={styles.body}>• Tiny, unusual lens-like circles in objects facing private areas{"\n"}• Unexpected reflections when slowly changing your viewing angle{"\n"}• Devices or indicators that do not belong in the room</Text><Text style={styles.note}>A phone camera may not reliably reveal infrared emitters. This version does not analyze live frames or detect lens glints automatically.</Text></Card>
  </ScrollView>;

  const renderDevices = () => <ScrollView contentContainerStyle={styles.content}>
    <Header title="Nearby devices" subtitle="Listen for Bluetooth Low Energy advertisements nearby." />
    <Card><Text style={styles.cardTitle}>Bluetooth scan</Text><Text style={styles.body}>Bluetooth: {bleState === State.PoweredOn ? "On" : bleState}</Text><Action label={scanning ? "Stop scan" : "Scan for 15 seconds"} onPress={startBleScan} />{scanning && <ActivityIndicator color={C.teal} style={{ marginTop: 12 }} />}</Card>
    {devices.map(d => <Card key={d.id}><Text style={styles.deviceName}>{d.name || "Unnamed Bluetooth device"}</Text><Text style={styles.muted}>ID: {d.id}</Text><Text style={styles.muted}>Signal: {d.rssi ?? "unknown"} dBm</Text></Card>)}
    {!devices.length && <Text style={styles.muted}>No devices recorded in this session yet.</Text>}
    <Card><Text style={styles.note}>A nearby Bluetooth device is not proof of a tracker or camera. Many phones, watches, earbuds and household devices advertise over BLE. Some trackers may not be discoverable during a short scan. Use your phone’s built-in unknown-tracker alerts as an additional check.</Text></Card>
  </ScrollView>;

  const renderChecklist = () => <ScrollView contentContainerStyle={styles.content}>
    <Header title="Physical checklist" subtitle="A careful visual inspection is still important." />
    <Card><Text style={styles.cardTitle}>{checked.length} of {checklist.length} completed</Text><View style={styles.progress}><View style={[styles.progressFill, { width: (checked.length / checklist.length * 100) + "%" }]} /></View>{checklist.map((item, i) => <TouchableOpacity key={item} style={styles.checkRow} onPress={() => toggleItem(item)}><View style={[styles.checkBox, checked.includes(item) && styles.checkBoxDone]}><Text style={styles.checkMark}>{checked.includes(item) ? "✓" : ""}</Text></View><Text style={[styles.body, checked.includes(item) && styles.doneText]}>{item}</Text></TouchableOpacity>)}<Action label="Save checklist progress" onPress={() => saveRecord("Physical checklist", checked.length + " of " + checklist.length + " items completed.")} /></Card>
  </ScrollView>;

  const renderHistory = () => <ScrollView contentContainerStyle={styles.content}>
    <Header title="Inspection history" subtitle="Saved locally on this phone." />
    {history.length ? history.map(item => <Card key={item.id}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.muted}>{new Date(item.date).toLocaleString()}</Text><Text style={styles.body}>{item.details}</Text></Card>) : <Card><Text style={styles.body}>No saved checks yet. Your inspection records will appear here.</Text></Card>}
    <Text style={styles.note}>History is stored on this device. It is not uploaded to a Sweep account or cloud service.</Text>
  </ScrollView>;

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor={C.bg} />
    <View style={styles.main}>{tab === "Home" ? renderHome() : tab === "Camera" ? renderCamera() : tab === "Devices" ? renderDevices() : tab === "Checklist" ? renderChecklist() : renderHistory()}</View>
    <View style={styles.nav}>{(["Home", "Camera", "Devices", "Checklist", "History"] as Tab[]).map(t => <TouchableOpacity key={t} onPress={() => setTab(t)} style={styles.navItem}><Text style={[styles.navText, tab === t && styles.navActive]}>{t}</Text></TouchableOpacity>)}</View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, main: { flex: 1 }, content: { padding: 20, paddingBottom: 30, gap: 14 },
  header: { paddingTop: 12, paddingBottom: 8 }, brand: { color: C.text, fontSize: 13, fontWeight: "900", letterSpacing: 3, marginBottom: 22 },
  heading: { color: C.text, fontSize: 29, fontWeight: "800", letterSpacing: -0.7 }, muted: { color: C.muted, fontSize: 13, marginTop: 6, lineHeight: 19 },
  eyebrow: { color: C.teal, fontSize: 10, fontWeight: "800", letterSpacing: 2 }, card: { backgroundColor: C.panel, borderRadius: 18, padding: 17, borderWidth: 1, borderColor: C.line, gap: 10 },
  cardTitle: { color: C.text, fontSize: 18, fontWeight: "750" }, body: { color: "#D0D8E3", fontSize: 14, lineHeight: 21 }, note: { color: C.amber, fontSize: 12, lineHeight: 18 },
  action: { backgroundColor: C.teal, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 15, alignItems: "center", justifyContent: "center", flex: 1, minHeight: 44 },
  secondary: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line }, actionText: { color: "#09221D", fontWeight: "800", fontSize: 13 },
  stats: { flexDirection: "row", gap: 9 }, stat: { flex: 1, backgroundColor: C.panel, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line },
  statNumber: { color: C.text, fontSize: 23, fontWeight: "800" }, cameraFrame: { height: 390, backgroundColor: "#05070A", borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: C.line },
  cameraTag: { position: "absolute", top: 12, left: 12, backgroundColor: "#0009", padding: 8, borderRadius: 8 }, cameraTagText: { color: C.teal, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  row: { flexDirection: "row", gap: 10 }, deviceName: { color: C.text, fontWeight: "700", fontSize: 15 }, progress: { height: 6, backgroundColor: C.panel2, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: C.teal }, checkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  checkBox: { width: 23, height: 23, borderRadius: 7, borderWidth: 1, borderColor: C.muted, alignItems: "center", justifyContent: "center" }, checkBoxDone: { backgroundColor: C.teal, borderColor: C.teal },
  checkMark: { color: "#09221D", fontWeight: "900" }, doneText: { color: C.muted, textDecorationLine: "line-through" },
  nav: { flexDirection: "row", backgroundColor: C.panel, borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 11, paddingHorizontal: 3 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center" }, navText: { color: C.muted, fontSize: 10, fontWeight: "700" }, navActive: { color: C.teal }
});