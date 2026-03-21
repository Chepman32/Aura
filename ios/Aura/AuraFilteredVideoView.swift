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

private struct ColorCubeData {
  let dimension: Int
  let data: Data
}

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
  private var lutCache: [String: ColorCubeData] = [:]
  private let lutCacheLock = NSLock()
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

  private func filteredImage(
    for image: CIImage,
    time: Double,
    filterId: String,
    matrix: [CGFloat],
    intensity: CGFloat
  ) -> CIImage {
    let normalizedFilterId = filterId.trimmingCharacters(in: .whitespacesAndNewlines)
    let clampedIntensity = max(0, min(intensity, 1))

    guard clampedIntensity > 0.001 else {
      return image
    }

    switch normalizedFilterId.isEmpty ? "original" : normalizedFilterId {
    case "cinematic":
      return applyCinematicFilter(to: image, intensity: clampedIntensity)
    case "vintage":
      return applyVintageFilter(to: image, intensity: clampedIntensity, time: time)
    case "sketch":
      return applySketchFilter(to: image, intensity: clampedIntensity)
    case "noir":
      return applyNoirFilter(to: image, intensity: clampedIntensity)
    case "vhs":
      return applyVHSFilter(to: image, intensity: clampedIntensity, time: time)
    case "neon":
      return applyNeonFilter(to: image, intensity: clampedIntensity, time: time)
    case "arctic":
      return applyArcticFilter(to: image, intensity: clampedIntensity, time: time)
    case "sunset":
      return applySunsetFilter(to: image, intensity: clampedIntensity)
    case "emerald":
      return applyLUTFilter(to: image, lutName: "emerald", intensity: clampedIntensity)
    case "lavender":
      return applyLUTFilter(to: image, lutName: "lavender", intensity: clampedIntensity)
    case "bleach":
      return applyLUTFilter(to: image, lutName: "bleach", intensity: clampedIntensity)
    default:
      return applyColorMatrixFilter(
        to: image,
        matrix: matrix,
        intensity: clampedIntensity
      )
    }
  }

  private func filteredImage(for image: CIImage, time: Double) -> CIImage {
    let filterState = snapshotFilterState()
    return filteredImage(
      for: image,
      time: time,
      filterId: filterState.filterId,
      matrix: filterState.matrix,
      intensity: filterState.intensity
    )
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

  private func applyLUTFilter(
    to image: CIImage,
    lutName: String,
    intensity: CGFloat
  ) -> CIImage {
    guard
      let cubeData = loadColorCube(named: lutName),
      let colorCubeFilter = CIFilter(name: "CIColorCube")
    else {
      return image
    }

    colorCubeFilter.setValue(image, forKey: kCIInputImageKey)
    colorCubeFilter.setValue(cubeData.dimension, forKey: "inputCubeDimension")
    colorCubeFilter.setValue(cubeData.data, forKey: "inputCubeData")

    let filteredImage = (colorCubeFilter.outputImage ?? image).cropped(to: image.extent)
    return blendFilteredImage(image, with: filteredImage, intensity: intensity)
  }

  private func loadColorCube(named lutName: String) -> ColorCubeData? {
    lutCacheLock.lock()
    if let cached = lutCache[lutName] {
      lutCacheLock.unlock()
      return cached
    }
    lutCacheLock.unlock()

    guard
      let lutURL = Bundle.main.url(forResource: lutName, withExtension: "cube", subdirectory: "luts"),
      let cubeData = parseCubeFile(at: lutURL)
    else {
      return nil
    }

    lutCacheLock.lock()
    lutCache[lutName] = cubeData
    lutCacheLock.unlock()
    return cubeData
  }

  private func parseCubeFile(at url: URL) -> ColorCubeData? {
    guard let rawContents = try? String(contentsOf: url, encoding: .utf8) else {
      return nil
    }

    var dimension: Int?
    var cubeValues: [Float] = []

    for rawLine in rawContents.components(separatedBy: .newlines) {
      let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !line.isEmpty, !line.hasPrefix("#") else {
        continue
      }

      if line.hasPrefix("TITLE") {
        continue
      }

      if line.hasPrefix("LUT_3D_SIZE") {
        let components = line.split(whereSeparator: \.isWhitespace)
        guard
          let rawSize = components.last,
          let parsedDimension = Int(rawSize)
        else {
          return nil
        }

        dimension = parsedDimension
        continue
      }

      let components = line.split(whereSeparator: \.isWhitespace)
      guard components.count >= 3 else {
        continue
      }

      guard
        let red = Float(components[0]),
        let green = Float(components[1]),
        let blue = Float(components[2])
      else {
        return nil
      }

      cubeValues.append(red)
      cubeValues.append(green)
      cubeValues.append(blue)
      cubeValues.append(1)
    }

    guard
      let resolvedDimension = dimension,
      resolvedDimension > 1
    else {
      return nil
    }

    let expectedValueCount = resolvedDimension * resolvedDimension * resolvedDimension * 4
    guard cubeValues.count == expectedValueCount else {
      return nil
    }

    let data = cubeValues.withUnsafeBufferPointer { Data(buffer: $0) }
    return ColorCubeData(dimension: resolvedDimension, data: data)
  }

  private func applyCinematicFilter(to image: CIImage, intensity: CGFloat) -> CIImage {
    let clampedIntensity = max(0, min(intensity, 1))

    let baseImage = image
      .applyingFilter(
        "CIColorControls",
        parameters: [
          kCIInputSaturationKey: 1.02 + clampedIntensity * 0.10,
          kCIInputBrightnessKey: -0.01,
          kCIInputContrastKey: 1.04 + clampedIntensity * 0.22,
        ]
      )
      .applyingFilter(
        "CIHighlightShadowAdjust",
        parameters: [
          "inputShadowAmount": 0.10 + clampedIntensity * 0.10,
          "inputHighlightAmount": 0.92 - clampedIntensity * 0.12,
        ]
      )

    let luminanceMask = image
      .applyingFilter(
        "CIColorControls",
        parameters: [
          kCIInputSaturationKey: 0,
          kCIInputContrastKey: 1.15 + clampedIntensity * 0.25,
        ]
      )
      .clampedToExtent()

    let shadowMask = luminanceMask
      .applyingFilter("CIColorInvert")
      .applyingFilter(
        "CIGaussianBlur",
        parameters: [kCIInputRadiusKey: 10 + clampedIntensity * 10]
      )
      .cropped(to: image.extent)

    let highlightMask = luminanceMask
      .applyingFilter(
        "CIGaussianBlur",
        parameters: [kCIInputRadiusKey: 10 + clampedIntensity * 10]
      )
      .cropped(to: image.extent)

    let coolShadowLayer = baseImage
      .applyingFilter(
        "CITemperatureAndTint",
        parameters: [
          "inputNeutral": CIVector(x: 6500, y: 0),
          "inputTargetNeutral": CIVector(
            x: 8200 + clampedIntensity * 900,
            y: -28 - clampedIntensity * 14
          ),
        ]
      )
      .applyingFilter(
        "CIColorMatrix",
        parameters: [
          "inputRVector": CIVector(x: 0.90, y: 0.02, z: 0.00, w: 0),
          "inputGVector": CIVector(x: 0.00, y: 1.02, z: 0.05, w: 0),
          "inputBVector": CIVector(x: 0.00, y: 0.05, z: 1.12, w: 0),
          "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
          "inputBiasVector": CIVector(
            x: -0.01,
            y: 0.0,
            z: 0.01 + clampedIntensity * 0.02,
            w: 0
          ),
        ]
      )

    let warmHighlightLayer = baseImage
      .applyingFilter(
        "CITemperatureAndTint",
        parameters: [
          "inputNeutral": CIVector(x: 6500, y: 0),
          "inputTargetNeutral": CIVector(
            x: 4700 - clampedIntensity * 450,
            y: 26 + clampedIntensity * 10
          ),
        ]
      )
      .applyingFilter(
        "CIColorMatrix",
        parameters: [
          "inputRVector": CIVector(x: 1.10, y: 0.04, z: -0.03, w: 0),
          "inputGVector": CIVector(x: 0.02, y: 1.01, z: -0.02, w: 0),
          "inputBVector": CIVector(x: -0.03, y: 0.00, z: 0.90, w: 0),
          "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
          "inputBiasVector": CIVector(
            x: 0.02 + clampedIntensity * 0.015,
            y: 0.005,
            z: -0.01,
            w: 0
          ),
        ]
      )

    let splitShadowImage = coolShadowLayer.applyingFilter(
      "CIBlendWithMask",
      parameters: [
        kCIInputBackgroundImageKey: baseImage,
        kCIInputMaskImageKey: shadowMask,
      ]
    )
    .cropped(to: image.extent)

    let splitToneImage = warmHighlightLayer.applyingFilter(
      "CIBlendWithMask",
      parameters: [
        kCIInputBackgroundImageKey: splitShadowImage,
        kCIInputMaskImageKey: highlightMask,
      ]
    )
    .cropped(to: image.extent)

    let cinematicImage = splitToneImage
      .applyingFilter(
        "CISharpenLuminance",
        parameters: [kCIInputSharpnessKey: 0.20 + clampedIntensity * 0.35]
      )
      .applyingFilter(
        "CIBloom",
        parameters: [
          kCIInputRadiusKey: 1.2 + clampedIntensity * 1.3,
          kCIInputIntensityKey: 0.10 + clampedIntensity * 0.08,
        ]
      )
      .applyingFilter(
        "CIVignette",
        parameters: [
          kCIInputIntensityKey: 0.20 + clampedIntensity * 0.32,
          kCIInputRadiusKey: 1.4 + clampedIntensity * 0.35,
        ]
      )
      .cropped(to: image.extent)

    return blendFilteredImage(image, with: cinematicImage, intensity: clampedIntensity)
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

  private func applyNeonFilter(to image: CIImage, intensity: CGFloat, time: Double) -> CIImage {
    let clampedIntensity = max(0, min(intensity, 1))
    let extent = image.extent

    let coldBase = image
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0.70 - clampedIntensity * 0.22,
        kCIInputContrastKey: 1.02 + clampedIntensity * 0.14,
        kCIInputBrightnessKey: 0.02 + clampedIntensity * 0.03,
      ])
      .applyingFilter("CITemperatureAndTint", parameters: [
        "inputNeutral": CIVector(x: 6500, y: 0),
        "inputTargetNeutral": CIVector(x: 9800 + clampedIntensity * 1200, y: -22),
      ])
      .applyingFilter("CIHighlightShadowAdjust", parameters: [
        "inputShadowAmount": 0.35 + clampedIntensity * 0.20,
        "inputHighlightAmount": 0.96,
      ])
      .cropped(to: extent)

    guard let randomNoise = CIFilter(name: "CIRandomGenerator")?.outputImage else {
      return blendFilteredImage(image, with: coldBase, intensity: clampedIntensity)
    }

    let driftX = CGFloat(fmod(time * 6.0, 512))
    let driftY = CGFloat(fmod(time * 3.8, 512))

    let baseNoise = randomNoise
      .transformed(by: CGAffineTransform(translationX: driftX, y: driftY))
      .cropped(to: extent)

    let secondaryNoise = randomNoise
      .transformed(
        by: CGAffineTransform(scaleX: 1.35, y: 1.35)
          .translatedBy(x: -driftX * 0.55, y: driftY * 0.42)
      )
      .cropped(to: extent)

    let crystallineBranches = baseNoise
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0,
        kCIInputBrightnessKey: -0.38,
        kCIInputContrastKey: 8.5 + clampedIntensity * 4.0,
      ])
      .applyingFilter("CIMotionBlur", parameters: [
        kCIInputRadiusKey: 24.0 + clampedIntensity * 18.0,
        kCIInputAngleKey: Double.pi / 6,
      ])
      .applyingFilter("CIMotionBlur", parameters: [
        kCIInputRadiusKey: 10.0 + clampedIntensity * 8.0,
        kCIInputAngleKey: -Double.pi / 3.2,
      ])
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0,
        kCIInputBrightnessKey: -0.08,
        kCIInputContrastKey: 3.8,
      ])

    let featheredCrystals = secondaryNoise
      .applyingFilter("CICrystallize", parameters: [
        kCIInputRadiusKey: 5.0 + clampedIntensity * 4.0,
        kCIInputCenterKey: CIVector(x: extent.midX, y: extent.midY),
      ])
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0,
        kCIInputBrightnessKey: -0.18,
        kCIInputContrastKey: 2.6 + clampedIntensity * 1.4,
      ])
      .applyingFilter("CIGaussianBlur", parameters: [
        kCIInputRadiusKey: 0.8 + clampedIntensity * 0.8,
      ])
      .cropped(to: extent)

    let fineNeedles = secondaryNoise
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0,
        kCIInputBrightnessKey: -0.42,
        kCIInputContrastKey: 10.0 + clampedIntensity * 4.0,
      ])
      .applyingFilter("CIMotionBlur", parameters: [
        kCIInputRadiusKey: 14.0 + clampedIntensity * 10.0,
        kCIInputAngleKey: Double.pi / 2.7,
      ])
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0,
        kCIInputBrightnessKey: -0.10,
        kCIInputContrastKey: 4.2,
      ])

    let coverageMask = crystallineBranches
      .applyingFilter("CIScreenBlendMode", parameters: [kCIInputBackgroundImageKey: featheredCrystals])
      .applyingFilter("CIScreenBlendMode", parameters: [kCIInputBackgroundImageKey: fineNeedles])
      .applyingFilter("CIGaussianBlur", parameters: [
        kCIInputRadiusKey: 1.6 + clampedIntensity * 1.2,
      ])
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0,
        kCIInputBrightnessKey: -0.02,
        kCIInputContrastKey: 2.0 + clampedIntensity * 0.8,
      ])
      .cropped(to: extent)

    let blurredBase = coldBase
      .clampedToExtent()
      .applyingFilter("CIGaussianBlur", parameters: [
        kCIInputRadiusKey: 8.0 + clampedIntensity * 8.0,
      ])
      .cropped(to: extent)

    let frostedGlass = blurredBase
      .applyingFilter("CIBlendWithMask", parameters: [
        kCIInputBackgroundImageKey: coldBase,
        kCIInputMaskImageKey: coverageMask,
      ])
      .cropped(to: extent)

    let icyRidges = coverageMask
      .applyingFilter("CIColorMatrix", parameters: [
        "inputRVector": CIVector(x: 0.86, y: 0, z: 0, w: 0),
        "inputGVector": CIVector(x: 0, y: 0.92, z: 0, w: 0),
        "inputBVector": CIVector(x: 0, y: 0, z: 1.0, w: 0),
        "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0.22 + clampedIntensity * 0.18),
        "inputBiasVector": CIVector(x: 0.16, y: 0.20, z: 0.24, w: 0),
      ])
      .cropped(to: extent)

    let neonImage = icyRidges
      .applyingFilter("CIScreenBlendMode", parameters: [kCIInputBackgroundImageKey: frostedGlass])
      .applyingFilter("CIBloom", parameters: [
        kCIInputRadiusKey: 1.2 + clampedIntensity * 1.0,
        kCIInputIntensityKey: 0.12 + clampedIntensity * 0.10,
      ])
      .applyingFilter("CIVignette", parameters: [
        kCIInputIntensityKey: 0.22 + clampedIntensity * 0.20,
        kCIInputRadiusKey: 1.55,
      ])
      .cropped(to: extent)

    return blendFilteredImage(image, with: neonImage, intensity: clampedIntensity)
  }

  private func applySunsetFilter(to image: CIImage, intensity: CGFloat) -> CIImage {
    let clampedIntensity = max(0, min(intensity, 1))
    let extent = image.extent

    // 1. Warm colour grade: push toward golden-hour orange/amber
    //    Reduce blue channel, boost red, warm temperature significantly
    let graded = image
      .applyingFilter("CITemperatureAndTint", parameters: [
        "inputNeutral":       CIVector(x: 6500, y: 0),
        "inputTargetNeutral": CIVector(x: 3200 - clampedIntensity * 600, y: 14),
      ])
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 1.20 + clampedIntensity * 0.35,
        kCIInputContrastKey:   1.05 + clampedIntensity * 0.10,
        kCIInputBrightnessKey: 0.02,
      ])
      // Boost reds/oranges, crush blues — the defining sunset channel split
      .applyingFilter("CIColorMatrix", parameters: [
        "inputRVector": CIVector(x: 1.18 + clampedIntensity * 0.12, y: 0.05, z: -0.05, w: 0),
        "inputGVector": CIVector(x: 0.02, y: 0.95, z: -0.04, w: 0),
        "inputBVector": CIVector(x: -0.10, y: -0.08, z: 0.65 - clampedIntensity * 0.15, w: 0),
        "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
        "inputBiasVector": CIVector(x: 0.03, y: 0.01, z: -0.02, w: 0),
      ])

    // 2. Shadow toning: push shadows toward deep purple/magenta (classic golden hour)
    //    Lift shadows with a warm-purple bias, keep highlights orange
    let toned = graded
      .applyingFilter("CIHighlightShadowAdjust", parameters: [
        "inputShadowAmount":    0.65 + clampedIntensity * 0.20,
        "inputHighlightAmount": 0.80,
      ])

    // 3. Glow: bloom on highlights simulates the hazy atmospheric light scatter at sunset
    let bloomed = toned
      .applyingFilter("CIBloom", parameters: [
        kCIInputRadiusKey:    3.0 + clampedIntensity * 4.0,
        kCIInputIntensityKey: 0.25 + clampedIntensity * 0.30,
      ])
      .cropped(to: extent)

    // 4. Gradient sky burn: radial warm glow from top-center (where the sun would be)
    //    Use a radial gradient tinted orange, screen-blended so it only brightens
    let sunGlow = CIFilter(name: "CIRadialGradient", parameters: [
      "inputCenter":  CIVector(x: extent.midX, y: extent.maxY * 0.85),
      "inputRadius0": extent.width * 0.0,
      "inputRadius1": extent.width * 0.85,
      "inputColor0":  CIColor(red: 1.0, green: 0.45, blue: 0.05, alpha: 0.38 * clampedIntensity),
      "inputColor1":  CIColor(red: 0.8, green: 0.20, blue: 0.30, alpha: 0.0),
    ])?.outputImage?.cropped(to: extent)

    let withGlow: CIImage
    if let glow = sunGlow {
      withGlow = bloomed
        .applyingFilter("CIScreenBlendMode", parameters: [kCIInputBackgroundImageKey: glow])
        .cropped(to: extent)
    } else {
      withGlow = bloomed
    }

    // 5. Vignette: darken corners to focus on the warm centre
    let vignetted = withGlow
      .applyingFilter("CIVignette", parameters: [
        kCIInputIntensityKey: 0.45 + clampedIntensity * 0.30,
        kCIInputRadiusKey:    1.4 + clampedIntensity * 0.4,
      ])
      .cropped(to: extent)

    return blendFilteredImage(image, with: vignetted, intensity: clampedIntensity)
  }

  private func applyArcticFilter(to image: CIImage, intensity: CGFloat, time: Double) -> CIImage {
    let clampedIntensity = max(0, min(intensity, 1))
    let extent = image.extent

    let coldBase = image
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0.62 - clampedIntensity * 0.20,
        kCIInputContrastKey: 0.98 + clampedIntensity * 0.10,
        kCIInputBrightnessKey: 0.015 + clampedIntensity * 0.02,
      ])
      .applyingFilter("CITemperatureAndTint", parameters: [
        "inputNeutral": CIVector(x: 6500, y: 0),
        "inputTargetNeutral": CIVector(x: 8200 + clampedIntensity * 900, y: -10),
      ])
      .applyingFilter("CIHighlightShadowAdjust", parameters: [
        "inputShadowAmount": 0.22 + clampedIntensity * 0.14,
        "inputHighlightAmount": 0.98,
      ])
      .cropped(to: extent)

    guard let randomNoise = CIFilter(name: "CIRandomGenerator")?.outputImage else {
      return blendFilteredImage(image, with: coldBase, intensity: clampedIntensity)
    }

    let driftX = CGFloat(fmod(time * 2.4, 512))
    let driftY = CGFloat(fmod(time * 1.6, 512))

    let baseNoise = randomNoise
      .transformed(by: CGAffineTransform(translationX: driftX, y: driftY))
      .cropped(to: extent)

    let secondaryNoise = randomNoise
      .transformed(
        by: CGAffineTransform(scaleX: 1.45, y: 1.45)
          .translatedBy(x: -driftX * 0.35, y: driftY * 0.28)
      )
      .cropped(to: extent)

    let branchMask = baseNoise
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0,
        kCIInputBrightnessKey: -0.44,
        kCIInputContrastKey: 7.2 + clampedIntensity * 2.8,
      ])
      .applyingFilter("CIMotionBlur", parameters: [
        kCIInputRadiusKey: 18.0 + clampedIntensity * 10.0,
        kCIInputAngleKey: Double.pi / 5,
      ])
      .applyingFilter("CIMotionBlur", parameters: [
        kCIInputRadiusKey: 7.0 + clampedIntensity * 5.0,
        kCIInputAngleKey: -Double.pi / 3.6,
      ])
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0,
        kCIInputBrightnessKey: -0.16,
        kCIInputContrastKey: 2.2,
      ])

    let softCrystalMask = secondaryNoise
      .applyingFilter("CICrystallize", parameters: [
        kCIInputRadiusKey: 6.0 + clampedIntensity * 3.0,
        kCIInputCenterKey: CIVector(x: extent.midX, y: extent.midY),
      ])
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0,
        kCIInputBrightnessKey: -0.26,
        kCIInputContrastKey: 1.9 + clampedIntensity * 0.8,
      ])
      .applyingFilter("CIGaussianBlur", parameters: [
        kCIInputRadiusKey: 1.4 + clampedIntensity * 0.8,
      ])
      .cropped(to: extent)

    let coverageMask = branchMask
      .applyingFilter("CIScreenBlendMode", parameters: [kCIInputBackgroundImageKey: softCrystalMask])
      .applyingFilter("CIGaussianBlur", parameters: [
        kCIInputRadiusKey: 1.4 + clampedIntensity * 0.8,
      ])
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0,
        kCIInputBrightnessKey: -0.14,
        kCIInputContrastKey: 1.45 + clampedIntensity * 0.25,
      ])
      .cropped(to: extent)

    let blurredBase = coldBase
      .clampedToExtent()
      .applyingFilter("CIGaussianBlur", parameters: [
        kCIInputRadiusKey: 4.5 + clampedIntensity * 4.5,
      ])
      .cropped(to: extent)

    let frostedGlass = blurredBase
      .applyingFilter("CIBlendWithMask", parameters: [
        kCIInputBackgroundImageKey: coldBase,
        kCIInputMaskImageKey: coverageMask,
      ])
      .cropped(to: extent)

    let icyRidges = branchMask
      .applyingFilter("CIColorMatrix", parameters: [
        "inputRVector": CIVector(x: 0.95, y: 0, z: 0, w: 0),
        "inputGVector": CIVector(x: 0, y: 0.97, z: 0, w: 0),
        "inputBVector": CIVector(x: 0, y: 0, z: 1.0, w: 0),
        "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0.10 + clampedIntensity * 0.08),
        "inputBiasVector": CIVector(x: 0.04, y: 0.05, z: 0.08, w: 0),
      ])
      .cropped(to: extent)

    let icyMist = softCrystalMask
      .applyingFilter("CIColorMatrix", parameters: [
        "inputRVector": CIVector(x: 0.90, y: 0, z: 0, w: 0),
        "inputGVector": CIVector(x: 0, y: 0.94, z: 0, w: 0),
        "inputBVector": CIVector(x: 0, y: 0, z: 1.0, w: 0),
        "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0.05 + clampedIntensity * 0.05),
        "inputBiasVector": CIVector(x: 0.06, y: 0.08, z: 0.10, w: 0),
      ])
      .cropped(to: extent)

    let arcticImage = icyRidges
      .applyingFilter("CIScreenBlendMode", parameters: [kCIInputBackgroundImageKey: frostedGlass])
      .applyingFilter("CIScreenBlendMode", parameters: [kCIInputBackgroundImageKey: icyMist])
      .applyingFilter("CIBloom", parameters: [
        kCIInputRadiusKey: 0.8 + clampedIntensity * 0.8,
        kCIInputIntensityKey: 0.05 + clampedIntensity * 0.04,
      ])
      .applyingFilter("CIVignette", parameters: [
        kCIInputIntensityKey: 0.10 + clampedIntensity * 0.12,
        kCIInputRadiusKey: 1.65,
      ])
      .cropped(to: extent)

    return blendFilteredImage(image, with: arcticImage, intensity: clampedIntensity)
  }

  private func applyVHSFilter(to image: CIImage, intensity: CGFloat, time: Double) -> CIImage {
    let clampedIntensity = max(0, min(intensity, 1))
    let extent = image.extent

    // 1. Colour grade: washed-out, slightly warm, low contrast like a worn tape
    let graded = image
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0.55 + clampedIntensity * 0.15,
        kCIInputContrastKey:   0.82,
        kCIInputBrightnessKey: 0.02,
      ])
      .applyingFilter("CITemperatureAndTint", parameters: [
        "inputNeutral":       CIVector(x: 6500, y: 0),
        "inputTargetNeutral": CIVector(x: 5800, y: 12),
      ])

    // 2. Chroma bleed: shift the red channel right and blue channel left
    let redShift   = CGFloat(2.5 + sin(time * 7.3) * 0.8) * clampedIntensity
    let blueShift  = CGFloat(-1.8 + cos(time * 5.1) * 0.6) * clampedIntensity

    let redLayer = graded
      .transformed(by: CGAffineTransform(translationX: redShift, y: 0))
      .applyingFilter("CIColorMatrix", parameters: [
        "inputRVector": CIVector(x: 1, y: 0, z: 0, w: 0),
        "inputGVector": CIVector(x: 0, y: 0, z: 0, w: 0),
        "inputBVector": CIVector(x: 0, y: 0, z: 0, w: 0),
        "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
        "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 0),
      ])
      .cropped(to: extent)

    let blueLayer = graded
      .transformed(by: CGAffineTransform(translationX: blueShift, y: 0))
      .applyingFilter("CIColorMatrix", parameters: [
        "inputRVector": CIVector(x: 0, y: 0, z: 0, w: 0),
        "inputGVector": CIVector(x: 0, y: 0, z: 0, w: 0),
        "inputBVector": CIVector(x: 0, y: 0, z: 1, w: 0),
        "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
        "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 0),
      ])
      .cropped(to: extent)

    let greenLayer = graded
      .applyingFilter("CIColorMatrix", parameters: [
        "inputRVector": CIVector(x: 0, y: 0, z: 0, w: 0),
        "inputGVector": CIVector(x: 0, y: 1, z: 0, w: 0),
        "inputBVector": CIVector(x: 0, y: 0, z: 0, w: 0),
        "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
        "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 0),
      ])
      .cropped(to: extent)

    // Recombine channels via screen blend
    let chromaImage = redLayer
      .applyingFilter("CIAdditionCompositing", parameters: [kCIInputBackgroundImageKey: greenLayer])
      .applyingFilter("CIAdditionCompositing", parameters: [kCIInputBackgroundImageKey: blueLayer])
      .cropped(to: extent)

    // 3. Scanlines: tile a 4px stripe (1px dark + 3px clear) across the frame — no UIKit, thread-safe
    let stripeUnit = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 0.22 * clampedIntensity))
      .cropped(to: CGRect(x: 0, y: 0, width: 1, height: 1))
      .applyingFilter("CIAffineClamp", parameters: [kCIInputTransformKey: CGAffineTransform.identity])

    let tiled = stripeUnit
      .applyingFilter("CIAffineTile", parameters: [
        kCIInputTransformKey: CGAffineTransform(scaleX: extent.width, y: 4),
      ])
      .cropped(to: extent)

    let scanned = tiled
      .applyingFilter("CISourceOverCompositing", parameters: [
        kCIInputBackgroundImageKey: chromaImage,
      ])
      .cropped(to: extent)

    // 4. Horizontal tracking glitch: random-ish band that shifts rows sideways
    let glitchY      = extent.minY + extent.height * CGFloat(fmod(time * 0.37, 1.0))
    let glitchHeight = extent.height * 0.04
    let glitchShift  = CGFloat(sin(time * 23.0) * 6.0) * clampedIntensity

    let glitchBand = scanned
      .cropped(to: CGRect(x: extent.minX, y: glitchY, width: extent.width, height: glitchHeight))
      .transformed(by: CGAffineTransform(translationX: glitchShift, y: 0))
      .cropped(to: CGRect(x: extent.minX, y: glitchY, width: extent.width, height: glitchHeight))

    let withGlitch = glitchBand
      .applyingFilter("CISourceOverCompositing", parameters: [kCIInputBackgroundImageKey: scanned])
      .cropped(to: extent)

    // 5. Luminance noise (tape hiss)
    guard let noise = CIFilter(name: "CIRandomGenerator")?.outputImage else {
      return blendFilteredImage(image, with: withGlitch, intensity: clampedIntensity)
    }

    let luma = noise
      .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0,
        kCIInputBrightnessKey: -0.15,
        kCIInputContrastKey:   1.8,
      ])
      .applyingFilter("CIColorMatrix", parameters: [
        "inputRVector": CIVector(x: 0.06, y: 0, z: 0, w: 0),
        "inputGVector": CIVector(x: 0, y: 0.06, z: 0, w: 0),
        "inputBVector": CIVector(x: 0, y: 0, z: 0.06, w: 0),
        "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0.12 * clampedIntensity),
        "inputBiasVector": CIVector(x: 0.47, y: 0.47, z: 0.47, w: 0),
      ])

    let vhsImage = withGlitch
      .applyingFilter("CIOverlayBlendMode", parameters: [kCIInputBackgroundImageKey: luma])
      .cropped(to: extent)

    return blendFilteredImage(image, with: vhsImage, intensity: clampedIntensity)
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
    let matrixValues = parseFilterMatrixPayload(filterMatrixPayload as String) ?? filterMatrix.compactMap { value -> CGFloat? in
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

  private func parseFilterMatrixPayload(_ rawPayload: String) -> [CGFloat]? {
    let payload = rawPayload.trimmingCharacters(in: .whitespacesAndNewlines)
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
        if self.seekRequestId.intValue > 0 || self.seekToTime.doubleValue > 0 {
          self.seekIfNeeded()
        }
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

private enum AuraProjectPreviewError: LocalizedError {
  case assetUnavailable
  case imageGenerationFailed
  case jpegEncodingFailed
  case outputDirectoryUnavailable

  var errorDescription: String? {
    switch self {
    case .assetUnavailable:
      return "The source video could not be loaded."
    case .imageGenerationFailed:
      return "Aura could not render a preview image."
    case .jpegEncodingFailed:
      return "Aura could not encode the preview image."
    case .outputDirectoryUnavailable:
      return "Aura could not prepare the preview output directory."
    }
  }
}

extension AuraFilteredVideoView {
  func generateProjectPreview(
    projectId: String,
    sourceUri: String,
    filterId: String,
    filterMatrixPayload: String,
    filterIntensity: CGFloat,
    timeMs: Double
  ) async throws -> String {
    let previewFilterId = filterId.trimmingCharacters(in: .whitespacesAndNewlines)
    let previewMatrix = parseFilterMatrixPayload(filterMatrixPayload) ?? identityColorMatrix
    let previewIntensity = max(0, min(filterIntensity, 1))

    guard let asset = await loadAsset(from: sourceUri) else {
      throw AuraProjectPreviewError.assetUnavailable
    }

    let generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.requestedTimeToleranceBefore = .zero
    generator.requestedTimeToleranceAfter = .zero

    let time = CMTime(
      seconds: max(0, timeMs / 1000),
      preferredTimescale: 600
    )

    let rawImage = try generator.copyCGImage(at: time, actualTime: nil)
    let sourceImage = CIImage(cgImage: rawImage)
    let filtered = filteredImage(
      for: sourceImage.clampedToExtent(),
      time: max(0, timeMs / 1000),
      filterId: previewFilterId,
      matrix: previewMatrix,
      intensity: previewIntensity
    ).cropped(to: sourceImage.extent)

    guard let outputImage = ciContext.createCGImage(filtered, from: filtered.extent) else {
      throw AuraProjectPreviewError.imageGenerationFailed
    }

    let previewImage = UIImage(cgImage: outputImage)
    guard let jpegData = previewImage.jpegData(compressionQuality: 0.9) else {
      throw AuraProjectPreviewError.jpegEncodingFailed
    }

    let outputURL = try makeProjectPreviewURL(projectId: projectId)
    try jpegData.write(to: outputURL, options: .atomic)
    return outputURL.path
  }

  private func makeProjectPreviewURL(projectId: String) throws -> URL {
    let fileManager = FileManager.default
    guard let documentsDirectory = fileManager.urls(
      for: .documentDirectory,
      in: .userDomainMask
    ).first else {
      throw AuraProjectPreviewError.outputDirectoryUnavailable
    }

    let previewDirectory = documentsDirectory.appendingPathComponent(
      "project-previews",
      isDirectory: true
    )

    if !fileManager.fileExists(atPath: previewDirectory.path) {
      try fileManager.createDirectory(
        at: previewDirectory,
        withIntermediateDirectories: true
      )
    }

    let sanitizedProjectId = projectId.replacingOccurrences(
      of: "[^a-zA-Z0-9_-]",
      with: "_",
      options: .regularExpression
    )

    return previewDirectory.appendingPathComponent(
      "\(sanitizedProjectId)_\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
    )
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
