import Foundation
import AVFoundation
import React

@objc(AuraProjectPreview)
final class AuraProjectPreview: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(generatePreview:sourceUri:filterId:filterMatrixPayload:filterIntensity:timeMs:resolve:reject:)
  func generatePreview(
    _ projectId: String,
    sourceUri: String,
    filterId: String,
    filterMatrixPayload: String,
    filterIntensity: NSNumber,
    timeMs: NSNumber,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    Task.detached(priority: .utility) {
      do {
        let renderer = await MainActor.run {
          AuraFilteredVideoView(frame: .zero)
        }
        let previewPath = try await renderer.generateProjectPreview(
          projectId: projectId,
          sourceUri: sourceUri,
          filterId: filterId,
          filterMatrixPayload: filterMatrixPayload,
          filterIntensity: CGFloat(truncating: filterIntensity),
          timeMs: Double(truncating: timeMs)
        )

        resolve(previewPath)
      } catch {
        reject("preview_generation_failed", error.localizedDescription, error)
      }
    }
  }
}

private enum AuraVideoExporterModuleError: LocalizedError {
  case exportAlreadyInProgress

  var errorDescription: String? {
    switch self {
    case .exportAlreadyInProgress:
      return "Aura is already exporting a video."
    }
  }
}

@objc(AuraVideoExporter)
final class AuraVideoExporter: RCTEventEmitter {
  private let progressEventName = "AuraVideoExporterProgress"
  private let stateQueue = DispatchQueue(label: "com.aura.video-exporter")
  private var hasListeners = false
  private var activeExportSession: AVAssetExportSession?
  private var progressTimer: DispatchSourceTimer?

  override static func requiresMainQueueSetup() -> Bool {
    false
  }

  override func supportedEvents() -> [String]! {
    [progressEventName]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc(exportVideo:filterId:filterMatrixPayload:filterIntensity:exportFormat:resolve:reject:)
  func exportVideo(
    _ sourceUri: String,
    filterId: String,
    filterMatrixPayload: String,
    filterIntensity: NSNumber,
    exportFormat: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    Task.detached(priority: .utility) { [weak self] in
      guard let self else { return }

      do {
        let renderer = await MainActor.run {
          AuraFilteredVideoView(frame: .zero)
        }

        let configuredExport = try await renderer.makeExportSession(
          sourceUri: sourceUri,
          filterId: filterId,
          filterMatrixPayload: filterMatrixPayload,
          filterIntensity: CGFloat(truncating: filterIntensity),
          exportFormat: exportFormat
        )

        try self.registerActiveExport(session: configuredExport.session)
        self.startProgressUpdates(for: configuredExport.session)

        defer {
          self.stopProgressUpdates()
          self.clearActiveExportState()
        }

        let outputPath = try await self.runExport(
          session: configuredExport.session,
          outputURL: configuredExport.outputURL
        )

        resolve(outputPath)
      } catch {
        reject("video_export_failed", error.localizedDescription, error)
      }
    }
  }

  @objc(cancelExport:reject:)
  func cancelExport(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    activeSession()?.cancelExport()
    resolve(nil)
  }

  private func runExport(
    session: AVAssetExportSession,
    outputURL: URL
  ) async throws -> String {
    try await withCheckedThrowingContinuation { continuation in
      session.exportAsynchronously {
        switch session.status {
        case .completed:
          continuation.resume(returning: outputURL.path)
        case .cancelled:
          continuation.resume(throwing: AuraVideoExportError.exportCancelled)
        case .failed:
          let message = session.error?.localizedDescription ?? "The export failed."
          continuation.resume(throwing: AuraVideoExportError.exportFailed(message))
        default:
          let message = session.error?.localizedDescription ?? "The export did not finish."
          continuation.resume(throwing: AuraVideoExportError.exportFailed(message))
        }
      }
    }
  }

  private func registerActiveExport(session: AVAssetExportSession) throws {
    try stateQueue.sync {
      if activeExportSession != nil {
        throw AuraVideoExporterModuleError.exportAlreadyInProgress
      }

      activeExportSession = session
    }
  }

  private func clearActiveExportState() {
    stateQueue.sync {
      activeExportSession = nil
    }
  }

  private func activeSession() -> AVAssetExportSession? {
    stateQueue.sync {
      activeExportSession
    }
  }

  private func startProgressUpdates(for session: AVAssetExportSession) {
    stopProgressUpdates()
    emitProgress(0)

    let timer = DispatchSource.makeTimerSource(queue: stateQueue)
    timer.schedule(deadline: .now(), repeating: .milliseconds(120))
    timer.setEventHandler { [weak self, weak session] in
      guard let self, let session else { return }
      self.emitProgress(session.progress)
    }

    stateQueue.sync {
      progressTimer = timer
    }

    timer.resume()
  }

  private func stopProgressUpdates() {
    let timer = stateQueue.sync { () -> DispatchSourceTimer? in
      let currentTimer = progressTimer
      progressTimer = nil
      return currentTimer
    }

    timer?.cancel()
  }

  private func emitProgress(_ progress: Float) {
    let clampedProgress = max(0, min(progress, 1))

    DispatchQueue.main.async { [weak self] in
      guard let self, self.hasListeners else { return }
      self.sendEvent(
        withName: self.progressEventName,
        body: ["progress": Double(clampedProgress)]
      )
    }
  }
}
