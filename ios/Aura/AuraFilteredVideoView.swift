import AVFoundation
import CoreImage
import Metal
import Photos
import React
import UIKit

private let identityColorMatrix: [CGFloat] = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
]

@objc(AuraFilteredVideoView)
final class AuraFilteredVideoView: UIView {
  @objc var sourceUri: NSString? {
    didSet {
      let previousValue = oldValue as String?
      let nextValue = sourceUri as String?
      if previousValue != nextValue {
        configureSource()
      }
    }
  }

  @objc var paused = true {
    didSet {
      updatePlaybackState()
    }
  }

  @objc var muted = false {
    didSet {
      player.isMuted = muted
    }
  }

  @objc var repeatVideo = false

  @objc var resizeMode: NSString = "cover" {
    didSet {
      updateVideoGravity()
    }
  }

  @objc var filterId: NSString = "original" {
    didSet {
      updateFilterState()
    }
  }

  @objc var filterMatrix: NSArray = [] {
    didSet {
      updateFilterState()
    }
  }

  @objc var filterMatrixPayload: NSString = "" {
    didSet {
      updateFilterState()
    }
  }

  @objc var filterIntensity: NSNumber = 1 {
    didSet {
      updateFilterState()
    }
  }

  @objc var seekToTime: NSNumber = 0

  @objc var seekRequestId: NSNumber = 0 {
    didSet {
      seekIfNeeded()
    }
  }

  @objc var onLoad: RCTDirectEventBlock?
  @objc var onProgress: RCTDirectEventBlock?
  @objc var onEnd: RCTDirectEventBlock?

  private let player = AVPlayer()
  private let playerLayer = AVPlayerLayer()
  private let filterStateLock = NSLock()
  private let ciContext: CIContext = {
    if let device = MTLCreateSystemDefaultDevice() {
      return CIContext(mtlDevice: device)
    }
    return CIContext()
  }()

  private var sourceTask: Task<Void, Never>?
  private var timeObserver: Any?
  private var endObserver: NSObjectProtocol?
  private var itemStatusObservation: NSKeyValueObservation?
  private var currentFilterId = "original"
  private var currentMatrix = identityColorMatrix
  private var currentIntensity: CGFloat = 1
  private var scheduledFrameRefresh: DispatchWorkItem?
  private var isRefreshingCurrentFrame = false
  private var needsAnotherFrameRefresh = false

  override init(frame: CGRect) {
    super.init(frame: frame)
    commonInit()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    commonInit()
  }

  deinit {
    sourceTask?.cancel()
    scheduledFrameRefresh?.cancel()
    tearDownCurrentItemObservers()
    if let timeObserver {
      player.removeTimeObserver(timeObserver)
    }
    player.replaceCurrentItem(with: nil)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    playerLayer.frame = bounds
  }

  private func commonInit() {
    backgroundColor = .black
    clipsToBounds = true

    playerLayer.player = player
    layer.addSublayer(playerLayer)

    player.isMuted = muted
    updateVideoGravity()
    updateFilterState()
    installTimeObserver()
  }

  private func installTimeObserver() {
    let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
    timeObserver = player.addPeriodicTimeObserver(
      forInterval: interval,
      queue: .main
    ) { [weak self] currentTime in
      guard let self else { return }
      let seconds = currentTime.seconds
      guard seconds.isFinite else { return }
      self.onProgress?(["currentTime": seconds])
    }
  }

  private func configureSource() {
    sourceTask?.cancel()
    tearDownCurrentItemObservers()

    guard let rawUri = sourceUri as String? else {
      player.replaceCurrentItem(with: nil)
      return
    }

    let trimmedUri = rawUri.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedUri.isEmpty else {
      player.replaceCurrentItem(with: nil)
      return
    }

    sourceTask = Task { [weak self] in
      guard let self else { return }
      guard let item = await self.preparePlayerItem(for: trimmedUri) else { return }
      guard !Task.isCancelled else { return }

      await MainActor.run {
        guard self.sourceUri as String? == trimmedUri else { return }
        self.attachPlayerItem(item)
      }
    }
  }

  private func preparePlayerItem(for uri: String) async -> AVPlayerItem? {
    guard let asset = await loadAsset(from: uri) else {
      return nil
    }

    let item = AVPlayerItem(asset: asset)
    item.videoComposition = makeVideoComposition(for: asset)
    return item
  }

  private func loadAsset(from uri: String) async -> AVAsset? {
    if uri.hasPrefix("ph://") {
      return await loadPhotoLibraryAsset(from: uri)
    }

    guard let url = makeURL(from: uri) else {
      return nil
    }

    return AVURLAsset(
      url: url,
      options: [AVURLAssetPreferPreciseDurationAndTimingKey: true]
    )
  }

  private func loadPhotoLibraryAsset(from uri: String) async -> AVAsset? {
    let assetId = String(uri.dropFirst("ph://".count))
    guard let photoAsset = PHAsset.fetchAssets(
      withLocalIdentifiers: [assetId],
      options: nil
    ).firstObject else {
      return nil
    }

    let options = PHVideoRequestOptions()
    options.isNetworkAccessAllowed = true

    return await withCheckedContinuation { continuation in
      PHCachingImageManager().requestAVAsset(
        forVideo: photoAsset,
        options: options
      ) { asset, _, _ in
        continuation.resume(returning: asset)
      }
    }
  }

  private func makeURL(from uri: String) -> URL? {
    if uri.contains("://") {
      return URL(string: uri)
    }

    if uri.hasPrefix("/") {
      return URL(fileURLWithPath: uri)
    }

    return URL(string: uri)
  }

  private func makeVideoComposition(for asset: AVAsset) -> AVVideoComposition {
    let filterHandler: (AVAsynchronousCIImageFilteringRequest) -> Void = { [weak self] request in
      let sourceImage = request.sourceImage.clampedToExtent()
      let compositionTime = request.compositionTime.seconds
      let time = compositionTime.isFinite ? compositionTime : 0
      guard let self else {
        request.finish(with: request.sourceImage, context: nil)
        return
      }

      let outputImage = self.filteredImage(for: sourceImage, time: time).cropped(to: request.sourceImage.extent)
      request.finish(with: outputImage, context: self.ciContext)
    }

    return AVVideoComposition(
      asset: asset,
      applyingCIFiltersWithHandler: filterHandler
    )
  }

  private func filteredImage(for image: CIImage, time: Double) -> CIImage {
    let (filterId, matrix, intensity) = snapshotFilterState()

    guard intensity > 0.001 else {
      return image
    }

    switch filterId {
    case "vintage":
      return applyVintageFilter(to: image, intensity: intensity, time: time)
    case "sketch":
      return applySketchFilter(to: image, intensity: intensity)
    case "noir":
      return applyNoirFilter(to: image, intensity: intensity)
    default:
      return applyColorMatrixFilter(to: image, matrix: matrix, intensity: intensity)
    }
  }

  private func applyColorMatrixFilter(
    to image: CIImage,
    matrix: [CGFloat],
    intensity: CGFloat
  ) -> CIImage {
    let interpolated = zip(identityColorMatrix, matrix).map { identityValue, targetValue in
      identityValue + (targetValue - identityValue) * intensity
    }

    guard let colorMatrixFilter = CIFilter(name: "CIColorMatrix") else {
      return image
    }

    colorMatrixFilter.setValue(image, forKey: kCIInputImageKey)
    colorMatrixFilter.setValue(
      CIVector(
        x: interpolated[0],
        y: interpolated[1],
        z: interpolated[2],
        w: interpolated[3]
      ),
      forKey: "inputRVector"
    )
    colorMatrixFilter.setValue(
      CIVector(
        x: interpolated[5],
        y: interpolated[6],
        z: interpolated[7],
        w: interpolated[8]
      ),
      forKey: "inputGVector"
    )
    colorMatrixFilter.setValue(
      CIVector(
        x: interpolated[10],
        y: interpolated[11],
        z: interpolated[12],
        w: interpolated[13]
      ),
      forKey: "inputBVector"
    )
    colorMatrixFilter.setValue(
      CIVector(
        x: interpolated[15],
        y: interpolated[16],
        z: interpolated[17],
        w: interpolated[18]
      ),
      forKey: "inputAVector"
    )
    colorMatrixFilter.setValue(
      CIVector(
        x: interpolated[4],
        y: interpolated[9],
        z: interpolated[14],
        w: interpolated[19]
      ),
      forKey: "inputBiasVector"
    )

    let matrixOutput = colorMatrixFilter.outputImage ?? image

    guard let clampFilter = CIFilter(name: "CIColorClamp") else {
      return matrixOutput
    }

    clampFilter.setValue(matrixOutput, forKey: kCIInputImageKey)
    clampFilter.setValue(CIVector(x: 0, y: 0, z: 0, w: 0), forKey: "inputMinComponents")
    clampFilter.setValue(CIVector(x: 1, y: 1, z: 1, w: 1), forKey: "inputMaxComponents")

    return clampFilter.outputImage ?? matrixOutput
  }

  private func applyVintageFilter(to image: CIImage, intensity: CGFloat, time: Double) -> CIImage {
    let clampedIntensity = max(0, min(intensity, 1))
    let flicker = CGFloat(sin(time * 12.0) * 0.03 + sin(time * 23.0 + 0.7) * 0.015)

    let monochromeBase = image
      .applyingFilter("CIPhotoEffectTonal")
      .applyingFilter(
        "CIColorControls",
        parameters: [
          kCIInputSaturationKey: 0.12 + clampedIntensity * 0.08,
          kCIInputBrightnessKey: 0.01 + flicker * (0.5 + clampedIntensity * 0.4),
          kCIInputContrastKey: 1.02 + clampedIntensity * 0.16,
        ]
      )

    let oldStockImage = monochromeBase.applyingFilter(
      "CIHighlightShadowAdjust",
      parameters: [
        "inputShadowAmount": 0.42 + clampedIntensity * 0.18,
        "inputHighlightAmount": 0.74 - clampedIntensity * 0.12,
      ]
    )
    .applyingFilter(
      "CISepiaTone",
      parameters: [kCIInputIntensityKey: 0.10 + clampedIntensity * 0.10]
    )
    .applyingFilter(
      "CITemperatureAndTint",
      parameters: [
        "inputNeutral": CIVector(x: 6500, y: 0),
        "inputTargetNeutral": CIVector(
          x: 6000 - clampedIntensity * 300,
          y: 8 + clampedIntensity * 8
        ),
      ]
    )
    .applyingFilter(
      "CIColorControls",
      parameters: [
        kCIInputSaturationKey: 0.10 + clampedIntensity * 0.04,
        kCIInputBrightnessKey: 0.015,
        kCIInputContrastKey: 1.06 + clampedIntensity * 0.10,
      ]
    )
    .applyingFilter(
      "CIExposureAdjust",
      parameters: [kCIInputEVKey: flicker * 1.2]
    )
    .applyingFilter(
      "CIBloom",
      parameters: [
        kCIInputRadiusKey: 1.0 + clampedIntensity * 0.8,
        kCIInputIntensityKey: 0.10 + clampedIntensity * 0.08,
      ]
    )

    let baseWithVignette = oldStockImage.applyingFilter(
      "CIVignette",
      parameters: [
        kCIInputIntensityKey: 0.38 + clampedIntensity * 0.32,
        kCIInputRadiusKey: 1.5 + clampedIntensity * 0.35,
      ]
    )
    .cropped(to: image.extent)

    let randomNoise = CIFilter(name: "CIRandomGenerator")?.outputImage ?? image
    let noiseOffsetX = CGFloat(time * 47.0).truncatingRemainder(dividingBy: 512)
    let noiseOffsetY = CGFloat(time * 29.0).truncatingRemainder(dividingBy: 512)
    let animatedNoise = randomNoise
      .transformed(by: CGAffineTransform(translationX: noiseOffsetX, y: noiseOffsetY))
      .cropped(to: image.extent)

    let grainLayer = animatedNoise
      .applyingFilter(
        "CIColorControls",
        parameters: [
          kCIInputSaturationKey: 0,
          kCIInputBrightnessKey: -0.02,
          kCIInputContrastKey: 1.65 + clampedIntensity * 0.35,
        ]
      )
      .applyingFilter(
        "CIColorMatrix",
        parameters: [
          "inputRVector": CIVector(x: 0.18, y: 0, z: 0, w: 0),
          "inputGVector": CIVector(x: 0, y: 0.18, z: 0, w: 0),
          "inputBVector": CIVector(x: 0, y: 0, z: 0.18, w: 0),
          "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0.09 + clampedIntensity * 0.08),
          "inputBiasVector": CIVector(x: 0.41, y: 0.38, z: 0.33, w: 0),
        ]
      )
      .cropped(to: image.extent)

    let grainyImage = grainLayer.applyingFilter(
      "CIOverlayBlendMode",
      parameters: [kCIInputBackgroundImageKey: baseWithVignette]
    )
    .cropped(to: image.extent)

    let scratchSeed = animatedNoise
      .applyingFilter(
        "CIColorControls",
        parameters: [
          kCIInputSaturationKey: 0,
          kCIInputBrightnessKey: -0.45,
          kCIInputContrastKey: 7.0 + clampedIntensity * 3.0,
        ]
      )
      .applyingFilter(
        "CIColorMatrix",
        parameters: [
          "inputRVector": CIVector(x: 16, y: 0, z: 0, w: 0),
          "inputGVector": CIVector(x: 0, y: 16, z: 0, w: 0),
          "inputBVector": CIVector(x: 0, y: 0, z: 16, w: 0),
          "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
          "inputBiasVector": CIVector(x: -13.8, y: -13.8, z: -13.8, w: 0),
        ]
      )
      .applyingFilter(
        "CIMotionBlur",
        parameters: [
          kCIInputRadiusKey: 18 + clampedIntensity * 18,
          kCIInputAngleKey: Double.pi / 2,
        ]
      )
      .applyingFilter(
        "CIColorMatrix",
        parameters: [
          "inputRVector": CIVector(x: 0.85, y: 0, z: 0, w: 0),
          "inputGVector": CIVector(x: 0, y: 0.82, z: 0, w: 0),
          "inputBVector": CIVector(x: 0, y: 0, z: 0.76, w: 0),
          "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0.16 + clampedIntensity * 0.12),
          "inputBiasVector": CIVector(x: 0.10, y: 0.08, z: 0.04, w: 0),
        ]
      )
      .cropped(to: image.extent)

    let dustSeed = randomNoise
      .transformed(
        by: CGAffineTransform(
          translationX: CGFloat(time * 83.0).truncatingRemainder(dividingBy: 512),
          y: CGFloat(time * 61.0).truncatingRemainder(dividingBy: 512)
        )
      )
      .cropped(to: image.extent)
      .applyingFilter(
        "CIColorControls",
        parameters: [
          kCIInputSaturationKey: 0,
          kCIInputBrightnessKey: -0.30,
          kCIInputContrastKey: 10.0 + clampedIntensity * 4.0,
        ]
      )
      .applyingFilter(
        "CIColorMatrix",
        parameters: [
          "inputRVector": CIVector(x: 10, y: 0, z: 0, w: 0),
          "inputGVector": CIVector(x: 0, y: 10, z: 0, w: 0),
          "inputBVector": CIVector(x: 0, y: 0, z: 10, w: 0),
          "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
          "inputBiasVector": CIVector(x: -8.9, y: -8.9, z: -8.9, w: 0),
        ]
      )
      .applyingFilter(
        "CIBloom",
        parameters: [
          kCIInputRadiusKey: 1.2,
          kCIInputIntensityKey: 0.25 + clampedIntensity * 0.15,
        ]
      )
      .applyingFilter(
        "CIColorMatrix",
        parameters: [
          "inputRVector": CIVector(x: 1, y: 0, z: 0, w: 0),
          "inputGVector": CIVector(x: 0, y: 1, z: 0, w: 0),
          "inputBVector": CIVector(x: 0, y: 0, z: 1, w: 0),
          "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0.06 + clampedIntensity * 0.05),
          "inputBiasVector": CIVector(x: 0.18, y: 0.16, z: 0.12, w: 0),
        ]
      )
      .cropped(to: image.extent)

    let scratchedImage = scratchSeed.applyingFilter(
      "CIScreenBlendMode",
      parameters: [kCIInputBackgroundImageKey: grainyImage]
    )
    .cropped(to: image.extent)

    let vintageImage = dustSeed.applyingFilter(
      "CIScreenBlendMode",
      parameters: [kCIInputBackgroundImageKey: scratchedImage]
    )
    .cropped(to: image.extent)

    return blendFilteredImage(image, with: vintageImage, intensity: clampedIntensity)
  }

  private func applyNoirFilter(to image: CIImage, intensity: CGFloat) -> CIImage {
    let clampedIntensity = max(0, min(intensity, 1))

    // CIPhotoEffectNoir: Apple's built-in high-contrast B&W with rich tonal depth
    let noirBase = image
      .applyingFilter("CIPhotoEffectNoir")
      .applyingFilter(
        "CIHighlightShadowAdjust",
        parameters: [
          "inputShadowAmount": 0.6 + clampedIntensity * 0.3,
          "inputHighlightAmount": 0.8 - clampedIntensity * 0.15,
        ]
      )
      .applyingFilter(
        "CIColorControls",
        parameters: [
          kCIInputContrastKey: 1.1 + clampedIntensity * 0.25,
          kCIInputBrightnessKey: -0.03 * clampedIntensity,
          kCIInputSaturationKey: 0,
        ]
      )
      .applyingFilter(
        "CIVignette",
        parameters: [
          kCIInputIntensityKey: 0.5 + clampedIntensity * 0.4,
          kCIInputRadiusKey: 1.2 + clampedIntensity * 0.5,
        ]
      )
      .cropped(to: image.extent)

    // Grain: CIRandomGenerator has infinite extent — clamp AFTER the full pipeline
    guard let randomNoise = CIFilter(name: "CIRandomGenerator")?.outputImage else {
      return blendFilteredImage(image, with: noirBase, intensity: clampedIntensity)
    }

    let grain = randomNoise
      .applyingFilter(
        "CIColorControls",
        parameters: [
          kCIInputSaturationKey: 0,
          kCIInputBrightnessKey: -0.1,
          kCIInputContrastKey: 2.0,
        ]
      )
      .applyingFilter(
        "CIColorMatrix",
        parameters: [
          "inputRVector": CIVector(x: 0.08, y: 0, z: 0, w: 0),
          "inputGVector": CIVector(x: 0, y: 0.08, z: 0, w: 0),
          "inputBVector": CIVector(x: 0, y: 0, z: 0.08, w: 0),
          "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0.07 + clampedIntensity * 0.05),
          "inputBiasVector": CIVector(x: 0.46, y: 0.46, z: 0.46, w: 0),
        ]
      )

    // noirBase is the background; grain overlays on top
    let noirImage = noirBase.applyingFilter(
      "CIOverlayBlendMode",
      parameters: [kCIInputBackgroundImageKey: grain]
    ).cropped(to: image.extent)

    return blendFilteredImage(image, with: noirImage, intensity: clampedIntensity)
  }

  private func applySketchFilter(to image: CIImage, intensity: CGFloat) -> CIImage {
    let clampedIntensity = max(0, min(intensity, 1))

    let grayscale = CIFilter(name: "CIColorControls")
    grayscale?.setValue(image, forKey: kCIInputImageKey)
    grayscale?.setValue(0, forKey: kCIInputSaturationKey)
    grayscale?.setValue(0.02 + clampedIntensity * 0.04, forKey: kCIInputBrightnessKey)
    grayscale?.setValue(1.0 + clampedIntensity * 0.5, forKey: kCIInputContrastKey)

    let grayscaleImage = grayscale?.outputImage ?? image

    let inverted = grayscaleImage.applyingFilter("CIColorInvert")
    let blurRadius = 6.0 + clampedIntensity * 10.0
    let blurredInverted = inverted
      .clampedToExtent()
      .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: blurRadius])
      .cropped(to: image.extent)

    let dodged = blurredInverted.applyingFilter(
      "CIColorDodgeBlendMode",
      parameters: [kCIInputBackgroundImageKey: grayscaleImage]
    )

    let edges = grayscaleImage
      .applyingFilter("CIEdges", parameters: [kCIInputIntensityKey: 1.5 + clampedIntensity * 4.0])
      .applyingFilter("CIColorInvert")

    let sketchImage = dodged.applyingFilter(
      "CIMultiplyCompositing",
      parameters: [kCIInputBackgroundImageKey: edges]
    )
    .applyingFilter(
      "CIColorControls",
      parameters: [
        kCIInputSaturationKey: 0,
        kCIInputBrightnessKey: 0.02,
        kCIInputContrastKey: 1.1 + clampedIntensity * 0.5,
      ]
    )
    .cropped(to: image.extent)

    return blendFilteredImage(image, with: sketchImage, intensity: clampedIntensity)
  }

  private func blendFilteredImage(
    _ image: CIImage,
    with filteredImage: CIImage,
    intensity: CGFloat
  ) -> CIImage {
    guard intensity < 0.999, let dissolve = CIFilter(name: "CIDissolveTransition") else {
      return filteredImage.cropped(to: image.extent)
    }

    dissolve.setValue(image, forKey: kCIInputImageKey)
    dissolve.setValue(filteredImage, forKey: "inputTargetImage")
    dissolve.setValue(intensity, forKey: kCIInputTimeKey)
    return dissolve.outputImage?.cropped(to: image.extent) ?? filteredImage.cropped(to: image.extent)
  }

  private func updateFilterState() {
    let nextFilterId = (filterId as String).trimmingCharacters(in: .whitespacesAndNewlines)
    let matrixValues = parseFilterMatrixPayload() ?? filterMatrix.compactMap { value -> CGFloat? in
      if let number = value as? NSNumber {
        return CGFloat(truncating: number)
      }

      if let double = value as? Double {
        return CGFloat(double)
      }

      return nil
    }
    let nextMatrix = matrixValues.count == identityColorMatrix.count ? matrixValues : identityColorMatrix
    let nextIntensity = max(0, min(CGFloat(truncating: filterIntensity), 1))

    filterStateLock.lock()
    currentFilterId = nextFilterId.isEmpty ? "original" : nextFilterId
    currentMatrix = nextMatrix
    currentIntensity = nextIntensity
    filterStateLock.unlock()

    scheduleFilterRefreshIfNeeded()
  }

  private func parseFilterMatrixPayload() -> [CGFloat]? {
    let payload = (filterMatrixPayload as String).trimmingCharacters(in: .whitespacesAndNewlines)
    guard !payload.isEmpty else { return nil }

    let values = payload.split(separator: ",").compactMap { component -> CGFloat? in
      let trimmed = component.trimmingCharacters(in: .whitespacesAndNewlines)
      guard let value = Double(trimmed) else { return nil }
      return CGFloat(value)
    }

    guard values.count == identityColorMatrix.count else {
      return nil
    }

    return values
  }

  private func snapshotFilterState() -> (filterId: String, matrix: [CGFloat], intensity: CGFloat) {
    filterStateLock.lock()
    let filterId = currentFilterId
    let matrix = currentMatrix
    let intensity = currentIntensity
    filterStateLock.unlock()
    return (filterId, matrix, intensity)
  }

  private func scheduleFilterRefreshIfNeeded() {
    if Thread.isMainThread {
      scheduleFilterRefreshIfNeededOnMain()
      return
    }

    DispatchQueue.main.async { [weak self] in
      self?.scheduleFilterRefreshIfNeededOnMain()
    }
  }

  private func scheduleFilterRefreshIfNeededOnMain() {
    guard player.currentItem != nil else { return }

    scheduledFrameRefresh?.cancel()

    let workItem = DispatchWorkItem { [weak self] in
      self?.applyFilterRefreshIfNeeded()
    }

    scheduledFrameRefresh = workItem
    DispatchQueue.main.async(execute: workItem)
  }

  private func applyFilterRefreshIfNeeded() {
    if !Thread.isMainThread {
      DispatchQueue.main.async { [weak self] in
        self?.applyFilterRefreshIfNeeded()
      }
      return
    }

    scheduledFrameRefresh = nil

    guard let item = player.currentItem, item.status == .readyToPlay else { return }
    item.videoComposition = makeVideoComposition(for: item.asset)
    refreshCurrentFrameIfPaused()
  }

  private func seekIfNeeded() {
    let seconds = max(0, Double(truncating: seekToTime))
    let targetTime = CMTime(seconds: seconds, preferredTimescale: 600)

    guard player.currentItem != nil else { return }

    player.seek(
      to: targetTime,
      toleranceBefore: .zero,
      toleranceAfter: .zero
    ) { [weak self] _ in
      guard let self else { return }
      self.onProgress?(["currentTime": seconds])
      self.refreshCurrentFrameIfPaused()
    }
  }

  private func refreshCurrentFrameIfPaused() {
    guard paused else { return }
    guard let item = player.currentItem, item.status == .readyToPlay else { return }

    if isRefreshingCurrentFrame {
      needsAnotherFrameRefresh = true
      return
    }

    isRefreshingCurrentFrame = true
    let currentTime = player.currentTime()

    player.seek(
      to: currentTime,
      toleranceBefore: .zero,
      toleranceAfter: .zero
    ) { [weak self] _ in
      guard let self else { return }

      self.isRefreshingCurrentFrame = false

      if self.needsAnotherFrameRefresh {
        self.needsAnotherFrameRefresh = false
        self.refreshCurrentFrameIfPaused()
      }
    }
  }

  private func attachPlayerItem(_ item: AVPlayerItem) {
    tearDownCurrentItemObservers()
    player.replaceCurrentItem(with: item)
    observeCurrentItem(item)
    updatePlaybackState()
  }

  private func observeCurrentItem(_ item: AVPlayerItem) {
    itemStatusObservation = item.observe(
      \.status,
      options: [.initial, .new]
    ) { [weak self] observedItem, _ in
      guard let self else { return }
      guard observedItem.status == .readyToPlay else { return }

      let duration = observedItem.duration.seconds.isFinite ? observedItem.duration.seconds : 0
      DispatchQueue.main.async {
        self.onLoad?(["duration": duration])
        self.updatePlaybackState()
        self.refreshCurrentFrameIfPaused()
      }
    }

    endObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] _ in
      self?.handlePlaybackEnded()
    }
  }

  private func tearDownCurrentItemObservers() {
    itemStatusObservation?.invalidate()
    itemStatusObservation = nil

    if let endObserver {
      NotificationCenter.default.removeObserver(endObserver)
      self.endObserver = nil
    }
  }

  private func handlePlaybackEnded() {
    if repeatVideo {
      player.seek(to: .zero) { [weak self] _ in
        guard let self else { return }
        self.refreshCurrentFrameIfPaused()
        if !self.paused {
          self.player.play()
        }
      }
      return
    }

    player.pause()
    player.seek(to: .zero) { [weak self] _ in
      guard let self else { return }
      self.refreshCurrentFrameIfPaused()
      self.onProgress?(["currentTime": 0])
      self.onEnd?([:])
    }
  }

  private func updatePlaybackState() {
    guard player.currentItem != nil else { return }

    if paused {
      player.pause()
      refreshCurrentFrameIfPaused()
    } else {
      player.play()
    }
  }

  private func updateVideoGravity() {
    switch resizeMode as String {
    case "contain":
      playerLayer.videoGravity = .resizeAspect
    case "stretch":
      playerLayer.videoGravity = .resize
    default:
      playerLayer.videoGravity = .resizeAspectFill
    }
  }
}

@objc(AuraFilteredVideoViewManager)
final class AuraFilteredVideoViewManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func view() -> UIView! {
    AuraFilteredVideoView()
  }
}
