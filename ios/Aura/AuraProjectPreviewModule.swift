import Foundation
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
