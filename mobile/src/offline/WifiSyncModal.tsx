import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { Palette } from "../theme/colors";
import GlassButton from "../components/GlassButton";
import GlassCard from "../components/GlassCard";
import { wifiSyncService } from "./WifiSyncService";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";

type Props = {
  visible: boolean;
  onClose: () => void;
  flatId?: number;
  flatName?: string;
  onSyncComplete?: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function WifiSyncModal({
  visible,
  onClose,
  flatId,
  flatName,
  onSyncComplete,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<"show_qr" | "scan_qr" | "wifi" | "import">("show_qr");
  const [localIp, setLocalIp] = useState("");
  const [targetIp, setTargetIp] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [discoveredPeers, setDiscoveredPeers] = useState<string[]>([]);
  const [importText, setImportText] = useState("");
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [clipboardPayload, setClipboardPayload] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (visible) {
      const ip = wifiSyncService.getLocalIp();
      setLocalIp(ip);
      setSyncStatus(null);
      setScanned(false);
      loadQrCode();
      checkClipboardForSyncData();
    }
  }, [visible, flatId]);

  async function loadQrCode() {
    try {
      const payload = await wifiSyncService.generateSyncPayload(flatId);
      setQrPayload(payload);
    } catch (err) {
      console.error("Failed to generate QR payload:", err);
    }
  }

  async function checkClipboardForSyncData() {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && (text.includes("FLATSPLIT_SYNC_V1") || text.includes("FLATSPLIT_FULL_SYNC_V1") || text.includes('"flat"') || text.includes('"flats"'))) {
        setClipboardPayload(text);
      } else {
        setClipboardPayload(null);
      }
    } catch {}
  }

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned || isSyncing) return;
    setScanned(true);
    Vibration.vibrate(100);

    setIsSyncing(true);
    try {
      const result = await wifiSyncService.applySyncPayload(data);
      if (result.success) {
        Alert.alert("Sync Successful! 🎉", result.message, [
          {
            text: "Done",
            onPress: () => {
              onSyncComplete?.();
              onClose();
            },
          },
        ]);
      } else {
        Alert.alert("QR Code Detected", result.message, [
          {
            text: "Try Again",
            onPress: () => setScanned(false),
          },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Scan Error", err.message || "Failed to process QR sync data.", [
        {
          text: "Try Again",
          onPress: () => setScanned(false),
        },
      ]);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleScanSubnet() {
    setIsScanning(true);
    setDiscoveredPeers([]);
    setSyncStatus("Scanning local Wi-Fi / Hotspot for roommates...");

    try {
      const peers = await wifiSyncService.scanSubnetForPeers((foundIp) => {
        setDiscoveredPeers((prev) => (prev.includes(foundIp) ? prev : [...prev, foundIp]));
      });

      if (peers.length === 0) {
        setSyncStatus("No active HTTP peer listeners found. You can sync in 1 second using the QR Code or Share Code!");
      } else {
        setSyncStatus(`Found ${peers.length} active roommate device(s) on Wi-Fi!`);
      }
    } catch {
      setSyncStatus("Subnet scan completed.");
    } finally {
      setIsScanning(false);
    }
  }

  async function handleDirectIpSync(ipToSync?: string) {
    const ip = (ipToSync || targetIp).trim();
    if (!ip) {
      Alert.alert("IP Required", "Please enter your roommate's local Wi-Fi IP address.");
      return;
    }

    setIsSyncing(true);
    setSyncStatus(`Syncing with ${ip}...`);

    try {
      const result = await wifiSyncService.syncWithPeerIp(ip, flatId);
      if (result.success) {
        Alert.alert("Sync Successful 🎉", result.message);
        setSyncStatus(result.message);
        onSyncComplete?.();
      } else {
        Alert.alert("Sync Notice", result.message);
        setSyncStatus(result.message);
      }
    } catch (err: any) {
      Alert.alert("Sync Error", err.message || "Could not sync over Wi-Fi.");
      setSyncStatus("Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleCopyShareCode() {
    try {
      const payload = await wifiSyncService.generateSyncPayload(flatId);
      await Clipboard.setStringAsync(payload);
      Alert.alert(
        "Copied to Clipboard! 📋",
        "Expense sync code copied. Paste it into WhatsApp, Telegram, or AirDrop to send to your roommates!"
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to generate sync code.");
    }
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setImportText(text);
      }
    } catch {}
  }

  async function handleApplyImport(customText?: string) {
    const dataToImport = (customText || importText).trim();
    if (!dataToImport) {
      Alert.alert("Empty Data", "Please paste the sync code from your roommate.");
      return;
    }

    setIsSyncing(true);
    try {
      const result = await wifiSyncService.applySyncPayload(dataToImport);
      if (result.success) {
        Alert.alert("Sync Successful! 🎉", result.message);
        setImportText("");
        setClipboardPayload(null);
        onSyncComplete?.();
        onClose();
      } else {
        Alert.alert("Import Failed", result.message);
      }
    } catch (err: any) {
      Alert.alert("Import Error", err.message || "Failed to import sync data.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleShareBackupFile() {
    try {
      const success = await wifiSyncService.exportToFile(flatId);
      if (!success) {
        Alert.alert("Notice", "Sharing dialog could not be opened.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to export backup file.");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
                <Feather name="refresh-cw" size={20} color={colors.accent} />
              </View>
              <View>
                <Text style={styles.title}>Offline P2P Wi-Fi Sync</Text>
                <Text style={styles.subtitle}>
                  {flatName ? `Sync "${flatName}" across phones` : "100% Offline • Instant Transfer"}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Quick Clipboard Banner */}
          {clipboardPayload && (
            <TouchableOpacity
              style={[styles.clipboardBanner, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
              onPress={() => handleApplyImport(clipboardPayload)}
              activeOpacity={0.8}
            >
              <Feather name="zap" size={16} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.clipboardTitle, { color: colors.accent }]}>
                  Found Flat Sync Data in Clipboard!
                </Text>
                <Text style={[styles.clipboardSubtitle, { color: colors.textPrimary }]}>
                  Tap here to 1-Click Sync & Merge
                </Text>
              </View>
              <Feather name="arrow-right" size={16} color={colors.accent} />
            </TouchableOpacity>
          )}

          {/* Navigation Tabs */}
          <View style={[styles.tabBar, { backgroundColor: colors.input }]}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "show_qr" && [styles.activeTab, { backgroundColor: colors.accent }]]}
              onPress={() => {
                setActiveTab("show_qr");
                setScanned(false);
              }}
              activeOpacity={0.8}
            >
              <Feather name="grid" size={14} color={activeTab === "show_qr" ? "#fff" : colors.textSecondary} />
              <Text style={[styles.tabText, { color: activeTab === "show_qr" ? "#fff" : colors.textSecondary }]}>
                My QR
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === "scan_qr" && [styles.activeTab, { backgroundColor: colors.accent }]]}
              onPress={() => {
                setActiveTab("scan_qr");
                setScanned(false);
                if (!permission?.granted) {
                  requestPermission();
                }
              }}
              activeOpacity={0.8}
            >
              <Feather name="camera" size={14} color={activeTab === "scan_qr" ? "#fff" : colors.textSecondary} />
              <Text style={[styles.tabText, { color: activeTab === "scan_qr" ? "#fff" : colors.textSecondary }]}>
                Scan QR
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === "wifi" && [styles.activeTab, { backgroundColor: colors.accent }]]}
              onPress={() => setActiveTab("wifi")}
              activeOpacity={0.8}
            >
              <Feather name="wifi" size={14} color={activeTab === "wifi" ? "#fff" : colors.textSecondary} />
              <Text style={[styles.tabText, { color: activeTab === "wifi" ? "#fff" : colors.textSecondary }]}>
                Wi-Fi IP
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === "import" && [styles.activeTab, { backgroundColor: colors.accent }]]}
              onPress={() => setActiveTab("import")}
              activeOpacity={0.8}
            >
              <Feather name="download" size={14} color={activeTab === "import" ? "#fff" : colors.textSecondary} />
              <Text style={[styles.tabText, { color: activeTab === "import" ? "#fff" : colors.textSecondary }]}>
                Code
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: SHOW QR CODE */}
          {activeTab === "show_qr" && (
            <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.qrSection}>
                <GlassCard style={styles.qrCard}>
                  <Text style={styles.qrHeading}>Scan to Sync Flat Data</Text>
                  <Text style={styles.qrSub}>
                    Have your roommate tap "Scan QR" and point their camera at this screen:
                  </Text>

                  {qrPayload ? (
                    <View style={styles.qrImageWrap}>
                      <QRCode
                        value={qrPayload}
                        size={210}
                        color="#0B1220"
                        backgroundColor="#FFFFFF"
                        ecl="M"
                      />
                    </View>
                  ) : (
                    <View style={{ height: 210, justifyContent: "center", alignItems: "center" }}>
                      <ActivityIndicator color={colors.accent} size="large" />
                    </View>
                  )}
                </GlassCard>

                <View style={{ gap: 10, marginTop: 14 }}>
                  <GlassButton
                    label="📋 Copy Instant Sync Code"
                    onPress={handleCopyShareCode}
                  />

                  <GlassButton
                    label="📤 Share Backup File (WhatsApp / Drive)"
                    onPress={handleShareBackupFile}
                    variant="glass"
                  />
                </View>
              </View>
            </ScrollView>
          )}

          {/* TAB 2: LIVE CAMERA QR SCANNER */}
          {activeTab === "scan_qr" && (
            <View style={styles.scannerContainer}>
              {!permission?.granted ? (
                <View style={styles.permissionBox}>
                  <Feather name="camera-off" size={40} color={colors.accent} />
                  <Text style={[styles.permTitle, { color: colors.textPrimary }]}>Camera Access Required</Text>
                  <Text style={[styles.permSub, { color: colors.textSecondary }]}>
                    FlatSplit needs camera access to scan your roommate's sync QR code.
                  </Text>
                  <GlassButton
                    label="Grant Camera Permission"
                    onPress={requestPermission}
                    style={{ marginTop: 16 }}
                  />
                </View>
              ) : (
                <View style={styles.cameraWrap}>
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    barcodeScannerSettings={{
                      barcodeTypes: ["qr"],
                    }}
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                  />
                  {/* Scanner Reticle Overlay */}
                  <View style={styles.overlay}>
                    <View style={styles.scanFrame}>
                      <View style={[styles.corner, styles.topLeft, { borderColor: colors.accent }]} />
                      <View style={[styles.corner, styles.topRight, { borderColor: colors.accent }]} />
                      <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.accent }]} />
                      <View style={[styles.corner, styles.bottomRight, { borderColor: colors.accent }]} />
                    </View>
                    <Text style={styles.scanHint}>Align roommate's QR code inside the box</Text>
                  </View>

                  {scanned && (
                    <View style={styles.rescanWrap}>
                      <GlassButton
                        label="Scan Again"
                        onPress={() => setScanned(false)}
                        style={{ alignSelf: "center" }}
                      />
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: SAME WI-FI PEER SYNC */}
          {activeTab === "wifi" && (
            <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
              <GlassCard style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Feather name="smartphone" size={16} color={colors.accent} />
                  <Text style={styles.infoTitle}>Your Phone's Wi-Fi IP:</Text>
                </View>
                <Text style={[styles.ipDisplay, { color: colors.accent }]}>
                  {localIp || "Checking connection..."}
                </Text>
                <Text style={styles.infoHint}>
                  Both phones should be connected to the same Wi-Fi network (or one phone's personal hotspot).
                </Text>
              </GlassCard>

              {/* Subnet Auto-Discovery */}
              <View style={styles.section}>
                <GlassButton
                  label={isScanning ? "Scanning Wi-Fi..." : "🔍 Auto-Find Roommates on Wi-Fi"}
                  onPress={handleScanSubnet}
                  loading={isScanning}
                  style={{ marginBottom: 12 }}
                />

                {syncStatus && (
                  <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                    {syncStatus}
                  </Text>
                )}

                {discoveredPeers.length > 0 && (
                  <View style={styles.peerList}>
                    <Text style={styles.sectionLabel}>Discovered Roommates:</Text>
                    {discoveredPeers.map((ip) => (
                      <TouchableOpacity
                        key={ip}
                        style={[styles.peerItem, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}
                        onPress={() => handleDirectIpSync(ip)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.peerInfo}>
                          <Feather name="hard-drive" size={16} color={colors.accent} />
                          <Text style={[styles.peerIp, { color: colors.textPrimary }]}>{ip}</Text>
                        </View>
                        <Text style={[styles.peerAction, { color: colors.accent }]}>Sync Now →</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Manual IP Connect */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Or Connect via Roommate's IP:</Text>
                <View style={styles.ipInputRow}>
                  <TextInput
                    style={[
                      styles.ipInput,
                      { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.textPrimary },
                    ]}
                    placeholder="e.g. 192.168.1.50"
                    placeholderTextColor={colors.textTertiary}
                    value={targetIp}
                    onChangeText={setTargetIp}
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                  />
                  <GlassButton
                    label="Sync"
                    onPress={() => handleDirectIpSync()}
                    loading={isSyncing}
                    style={styles.syncBtn}
                  />
                </View>
              </View>
            </ScrollView>
          )}

          {/* TAB 4: RECEIVE / IMPORT DATA */}
          {activeTab === "import" && (
            <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Paste Sync Code Received from Roommate:</Text>
              <TextInput
                style={[
                  styles.textArea,
                  { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.textPrimary },
                ]}
                placeholder="Paste sync code or JSON here..."
                placeholderTextColor={colors.textTertiary}
                value={importText}
                onChangeText={setImportText}
                multiline
                numberOfLines={4}
              />

              <View style={styles.importBtnRow}>
                <TouchableOpacity
                  style={[styles.pasteBtn, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}
                  onPress={handlePasteFromClipboard}
                  activeOpacity={0.7}
                >
                  <Feather name="clipboard" size={14} color={colors.accent} />
                  <Text style={[styles.pasteBtnText, { color: colors.accent }]}>Paste Clipboard</Text>
                </TouchableOpacity>

                <GlassButton
                  label="Merge & Sync"
                  onPress={() => handleApplyImport()}
                  loading={isSyncing}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "flex-end",
    },
    modalCard: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTopWidth: 1,
      maxHeight: "92%",
      padding: 20,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 17,
      fontWeight: "800",
      color: c.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      padding: 6,
    },
    clipboardBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 14,
    },
    clipboardTitle: {
      fontSize: 12,
      fontWeight: "800",
    },
    clipboardSubtitle: {
      fontSize: 11,
      marginTop: 1,
    },
    tabBar: {
      flexDirection: "row",
      borderRadius: 14,
      padding: 4,
      marginBottom: 16,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 8,
      borderRadius: 10,
    },
    activeTab: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 2,
    },
    tabText: {
      fontSize: 11,
      fontWeight: "700",
    },
    contentScroll: {
      maxHeight: 460,
    },
    qrSection: {
      alignItems: "stretch",
    },
    qrCard: {
      alignItems: "center",
      padding: 18,
    },
    qrHeading: {
      fontSize: 16,
      fontWeight: "800",
      color: c.textPrimary,
      marginBottom: 4,
    },
    qrSub: {
      fontSize: 12,
      color: c.textSecondary,
      textAlign: "center",
      marginBottom: 14,
    },
    qrImageWrap: {
      backgroundColor: "#FFFFFF",
      padding: 14,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    scannerContainer: {
      height: 380,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: "#000000",
    },
    permissionBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    permTitle: {
      fontSize: 17,
      fontWeight: "800",
      marginTop: 14,
      marginBottom: 6,
    },
    permSub: {
      fontSize: 13,
      textAlign: "center",
      lineHeight: 18,
    },
    cameraWrap: {
      flex: 1,
      position: "relative",
    },
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    scanFrame: {
      width: 220,
      height: 220,
      position: "relative",
    },
    corner: {
      position: "absolute",
      width: 24,
      height: 24,
      borderWidth: 4,
    },
    topLeft: {
      top: 0,
      left: 0,
      borderRightWidth: 0,
      borderBottomWidth: 0,
      borderTopLeftRadius: 10,
    },
    topRight: {
      top: 0,
      right: 0,
      borderLeftWidth: 0,
      borderBottomWidth: 0,
      borderTopRightRadius: 10,
    },
    bottomLeft: {
      bottom: 0,
      left: 0,
      borderRightWidth: 0,
      borderTopWidth: 0,
      borderBottomLeftRadius: 10,
    },
    bottomRight: {
      bottom: 0,
      right: 0,
      borderLeftWidth: 0,
      borderTopWidth: 0,
      borderBottomRightRadius: 10,
    },
    scanHint: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
      marginTop: 20,
      textShadowColor: "rgba(0,0,0,0.8)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    rescanWrap: {
      position: "absolute",
      bottom: 20,
      left: 0,
      right: 0,
      alignItems: "center",
    },
    infoCard: {
      padding: 14,
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    infoTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textPrimary,
    },
    ipDisplay: {
      fontSize: 20,
      fontWeight: "800",
      marginVertical: 6,
      letterSpacing: 0.5,
    },
    infoHint: {
      fontSize: 11,
      color: c.textTertiary,
      lineHeight: 16,
    },
    section: {
      marginBottom: 16,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textSecondary,
      marginBottom: 8,
    },
    statusText: {
      fontSize: 12,
      textAlign: "center",
      marginBottom: 10,
      lineHeight: 18,
    },
    peerList: {
      marginTop: 8,
    },
    peerItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 8,
    },
    peerInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    peerIp: {
      fontSize: 14,
      fontWeight: "700",
    },
    peerAction: {
      fontSize: 13,
      fontWeight: "700",
    },
    ipInputRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },
    ipInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
    },
    syncBtn: {
      minWidth: 90,
    },
    textArea: {
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
      fontSize: 13,
      height: 110,
      textAlignVertical: "top",
      marginBottom: 12,
    },
    importBtnRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },
    pasteBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    pasteBtnText: {
      fontSize: 13,
      fontWeight: "700",
    },
  });
}
