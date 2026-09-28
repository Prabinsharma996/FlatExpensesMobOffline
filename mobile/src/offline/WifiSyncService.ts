import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { offlineDb } from "./OfflineDatabase";
import axios from "axios";

export const SYNC_PORT = 4000;

export type SyncResult = {
  success: boolean;
  message: string;
  flatName?: string;
  mergedCount?: number;
};

export class WifiSyncService {
  private static instance: WifiSyncService;
  private isScanning = false;

  public static getInstance(): WifiSyncService {
    if (!WifiSyncService.instance) {
      WifiSyncService.instance = new WifiSyncService();
    }
    return WifiSyncService.instance;
  }

  // Get current device local IP from Expo Constants / network
  public getLocalIp(): string {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any).debuggerHost;

    if (hostUri) {
      const ip = hostUri.split(":")[0];
      if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
        return ip;
      }
    }
    return "192.168.1.100";
  }

  // Generate a shareable QR payload or JSON string for a flat
  public async generateSyncPayload(flatId?: number): Promise<string> {
    if (flatId) {
      return await offlineDb.exportFlatData(flatId);
    }
    const fullDb = await offlineDb.exportDatabaseSnapshot();
    return JSON.stringify({
      type: "FLATSPLIT_FULL_SYNC_V1",
      exportedAt: new Date().toISOString(),
      ...fullDb,
    });
  }

  // Apply sync payload received from Wi-Fi, QR code, or file
  public async applySyncPayload(payloadJson: string): Promise<SyncResult> {
    try {
      const res = await offlineDb.importAndMergeSyncData(payloadJson);
      return {
        success: true,
        message: `Synced successfully with "${res.flatName}"! (${res.mergedExpenses} expenses, ${res.mergedTasks} tasks updated)`,
        flatName: res.flatName,
        mergedCount: res.mergedExpenses + res.mergedTasks + res.mergedChores,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Failed to process sync data.",
      };
    }
  }

  // Direct sync with another device IP on the same Wi-Fi
  public async syncWithPeerIp(peerIp: string, flatId?: number): Promise<SyncResult> {
    const cleanIp = peerIp.trim().replace(/^http:\/\//, "").replace(/\/.*$/, "").split(":")[0];
    const targetUrl = `http://${cleanIp}:${SYNC_PORT}/api/sync`;

    try {
      // 1. Prepare our local flat data
      const myPayload = await this.generateSyncPayload(flatId);

      // 2. Send our data and receive remote peer data
      const response = await axios.post(
        targetUrl,
        JSON.parse(myPayload),
        { timeout: 8000 }
      );

      if (response.data) {
        const mergeResult = await offlineDb.importAndMergeSyncData(
          typeof response.data === "string" ? response.data : JSON.stringify(response.data)
        );
        return {
          success: true,
          message: `Connected & synchronized with ${cleanIp}!`,
          flatName: mergeResult.flatName,
          mergedCount: mergeResult.mergedExpenses,
        };
      }

      return {
        success: true,
        message: `Sent data to ${cleanIp} successfully!`,
      };
    } catch (err: any) {
      // If direct HTTP endpoint is not active, provide clear helpful instructions
      return {
        success: false,
        message: `Could not reach ${cleanIp}:${SYNC_PORT}. Make sure both phones are connected to the same Wi-Fi. You can also use QR Scan or Share File to sync instantly!`,
      };
    }
  }

  // Scan local Wi-Fi subnet (e.g. 192.168.1.x) for other FlatSplit devices
  public async scanSubnetForPeers(
    onPeerFound: (ip: string) => void
  ): Promise<string[]> {
    if (this.isScanning) return [];
    this.isScanning = true;

    const baseIp = this.getLocalIp();
    const parts = baseIp.split(".");
    if (parts.length !== 4) {
      this.isScanning = false;
      return [];
    }

    const subnetPrefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
    const myLastOctet = parseInt(parts[3], 10) || 100;
    const discoveredIps: string[] = [];

    // Scan nearby IP addresses in batches to keep performance smooth
    const candidates: string[] = [];
    for (let i = 1; i <= 254; i++) {
      if (i !== myLastOctet) {
        candidates.push(`${subnetPrefix}.${i}`);
      }
    }

    // Prioritize IPs close to our own IP
    candidates.sort((a, b) => {
      const octA = parseInt(a.split(".")[3], 10);
      const octB = parseInt(b.split(".")[3], 10);
      return Math.abs(octA - myLastOctet) - Math.abs(octB - myLastOctet);
    });

    const checkBatch = async (batch: string[]) => {
      await Promise.all(
        batch.map(async (ip) => {
          try {
            await axios.get(`http://${ip}:${SYNC_PORT}/health`, { timeout: 1200 });
            discoveredIps.push(ip);
            onPeerFound(ip);
          } catch {
            // No device on this IP
          }
        })
      );
    };

    try {
      // Scan top 30 closest IPs first
      const topBatch = candidates.slice(0, 30);
      await checkBatch(topBatch);
    } finally {
      this.isScanning = false;
    }

    return discoveredIps;
  }

  // Export Flat data to a shareable file (AirDrop / WhatsApp / Nearby Share)
  public async exportToFile(flatId?: number): Promise<boolean> {
    try {
      const payload = await this.generateSyncPayload(flatId);
      const filename = `flatsplit_backup_${Date.now()}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, payload, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/json",
          dialogTitle: "Share FlatSplit Expenses with Roommates",
          UTI: "public.json",
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error("File share error:", err);
      return false;
    }
  }
}

export const wifiSyncService = WifiSyncService.getInstance();
