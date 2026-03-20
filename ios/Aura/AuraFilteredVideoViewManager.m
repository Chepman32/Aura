#import <React/RCTComponent.h>
#import <React/RCTViewManager.h>

@interface RCT_EXTERN_REMAP_MODULE(AuraFilteredVideoView, AuraFilteredVideoViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(sourceUri, NSString)
RCT_EXPORT_VIEW_PROPERTY(paused, BOOL)
RCT_EXPORT_VIEW_PROPERTY(repeatVideo, BOOL)
RCT_EXPORT_VIEW_PROPERTY(resizeMode, NSString)
RCT_EXPORT_VIEW_PROPERTY(filterId, NSString)
RCT_EXPORT_VIEW_PROPERTY(filterMatrix, NSArray)
RCT_EXPORT_VIEW_PROPERTY(filterMatrixPayload, NSString)
RCT_EXPORT_VIEW_PROPERTY(filterIntensity, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(onLoad, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onProgress, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onEnd, RCTDirectEventBlock)

@end
