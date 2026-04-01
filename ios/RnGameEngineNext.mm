#import "RnGameEngineNext.h"
#import <UIKit/UIKit.h>

@implementation RnGameEngineNext

- (void)triggerHaptic:(NSString *)type {
  dispatch_async(dispatch_get_main_queue(), ^{
    if ([type isEqualToString:@"light"]) {
      UIImpactFeedbackGenerator *gen = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleLight];
      [gen prepare];
      [gen impactOccurred];
    } else if ([type isEqualToString:@"medium"]) {
      UIImpactFeedbackGenerator *gen = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleMedium];
      [gen prepare];
      [gen impactOccurred];
    } else if ([type isEqualToString:@"heavy"]) {
      UIImpactFeedbackGenerator *gen = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleHeavy];
      [gen prepare];
      [gen impactOccurred];
    } else if ([type isEqualToString:@"success"]) {
      UINotificationFeedbackGenerator *gen = [[UINotificationFeedbackGenerator alloc] init];
      [gen prepare];
      [gen notificationOccurred:UINotificationFeedbackTypeSuccess];
    } else if ([type isEqualToString:@"warning"]) {
      UINotificationFeedbackGenerator *gen = [[UINotificationFeedbackGenerator alloc] init];
      [gen prepare];
      [gen notificationOccurred:UINotificationFeedbackTypeWarning];
    } else if ([type isEqualToString:@"error"]) {
      UINotificationFeedbackGenerator *gen = [[UINotificationFeedbackGenerator alloc] init];
      [gen prepare];
      [gen notificationOccurred:UINotificationFeedbackTypeError];
    } else {
      UIImpactFeedbackGenerator *gen = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleMedium];
      [gen prepare];
      [gen impactOccurred];
    }
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRnGameEngineNextSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"RnGameEngineNext";
}

@end
