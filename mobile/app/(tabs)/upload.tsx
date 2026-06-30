import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "../../components/ui";
import {
  ApiError,
  uploadMaterial,
  type MaterialSummary,
  type PickedFile,
} from "../../lib/api";
import { theme } from "../../lib/theme";

// MIME types matching the backend's allowed extensions.
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; name: string }
  | { kind: "success"; material: MaterialSummary }
  | { kind: "error"; message: string };

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [history, setHistory] = useState<MaterialSummary[]>([]);

  async function pickAndUpload() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_MIME,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const file: PickedFile = {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
    };

    setStatus({ kind: "uploading", name: file.name });
    try {
      const res = await uploadMaterial(file);
      setStatus({ kind: "success", material: res.material });
      setHistory((prev) => [res.material, ...prev]);
    } catch (e) {
      const message =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Upload failed";
      setStatus({ kind: "error", message });
    }
  }

  const uploading = status.kind === "uploading";

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-2xl font-bold text-ink">Upload material</Text>
        <Text className="mt-1 text-sm text-muted">
          PDF, DOCX, PPTX or TXT — we’ll parse and index it.
        </Text>

        {/* Drop-zone */}
        <Pressable
          onPress={pickAndUpload}
          disabled={uploading}
          className="mt-6 items-center justify-center rounded-[28px] border-2 border-dashed border-primary/40 bg-primary-soft/40 px-6 py-12 active:opacity-80"
        >
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface shadow-sm shadow-primary/20">
            {uploading ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <Ionicons
                name="cloud-upload-outline"
                size={30}
                color={theme.primary}
              />
            )}
          </View>
          <Text className="text-base font-semibold text-ink">
            {uploading ? "Uploading…" : "Tap to choose a file"}
          </Text>
          <Text className="mt-1 text-center text-xs text-muted">
            {uploading
              ? status.name
              : "Opens your device’s document picker"}
          </Text>
        </Pressable>

        {/* Status banner */}
        {status.kind === "success" ? (
          <Card className="mt-5 border-success/30">
            <View className="flex-row items-center">
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.success}
              />
              <Text className="ml-2 text-sm font-semibold text-ink">
                Uploaded successfully
              </Text>
            </View>
            <Text className="mt-2 text-xs text-muted">
              {status.material.file_name} · {status.material.chunk_count} chunks
              indexed
            </Text>
          </Card>
        ) : null}

        {status.kind === "error" ? (
          <Card className="mt-5 border-danger/30">
            <View className="flex-row items-center">
              <Ionicons name="alert-circle" size={20} color={theme.danger} />
              <Text className="ml-2 text-sm font-semibold text-danger">
                {status.message}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* This session's uploads */}
        {history.length > 0 ? (
          <View className="mt-7">
            <Text className="mb-3 text-base font-semibold text-ink">
              This session
            </Text>
            {history.map((doc) => (
              <Card key={doc.id} className="mb-3">
                <View className="flex-row items-center">
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft">
                    <Text className="text-[10px] font-bold uppercase text-accent">
                      {doc.format}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      numberOfLines={1}
                      className="text-sm font-semibold text-ink"
                    >
                      {doc.file_name}
                    </Text>
                    <Text className="text-xs text-muted">
                      {doc.chunk_count} chunks · {doc.format.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
