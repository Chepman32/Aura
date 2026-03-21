#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(AuraProjectPreview, NSObject)

RCT_EXTERN_METHOD(
  generatePreview:(NSString *)projectId
  sourceUri:(NSString *)sourceUri
  filterId:(NSString *)filterId
  filterMatrixPayload:(NSString *)filterMatrixPayload
  filterIntensity:(nonnull NSNumber *)filterIntensity
  timeMs:(nonnull NSNumber *)timeMs
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

@end

@interface RCT_EXTERN_MODULE(AuraVideoExporter, RCTEventEmitter)

RCT_EXTERN_METHOD(
  exportVideo:(NSString *)sourceUri
  filterId:(NSString *)filterId
  filterMatrixPayload:(NSString *)filterMatrixPayload
  filterIntensity:(nonnull NSNumber *)filterIntensity
  exportFormat:(NSString *)exportFormat
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  cancelExport:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

@end
