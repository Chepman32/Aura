#import <React/RCTBridgeModule.h>

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

