import ExpoModulesCore
import ActivityKit

/// MUST stay identical to the copy in
/// targets/restactivity/RestTimerLiveActivity.swift. The app and the widget are
/// separate targets, and ActivityKit pairs them by the shape of this struct —
/// a field changed on one side alone fails at runtime, not at build time.
struct RestTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var startedAt: Date
        var endsAt: Date
        var exerciseName: String
    }

    var workoutName: String
}

public class RestActivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("RestActivity")

        /// False when the device is too old, or the user has turned Live
        /// Activities off for FitVerse in Settings. Callers treat it as a
        /// nice-to-have: the scheduled notification is what actually tells
        /// them rest is up.
        Function("areActivitiesEnabled") { () -> Bool in
            if #available(iOS 16.2, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

        /// Start, or retarget an already-running activity.
        ///
        /// Times cross from JS as epoch milliseconds — a JS Date does not
        /// survive the bridge as a Date.
        Function("start") {
            (workoutName: String, exerciseName: String, startedAtMs: Double, endsAtMs: Double) -> Bool in
            guard #available(iOS 16.2, *) else { return false }
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }

            let state = RestTimerAttributes.ContentState(
                startedAt: Date(timeIntervalSince1970: startedAtMs / 1000),
                endsAt: Date(timeIntervalSince1970: endsAtMs / 1000),
                exerciseName: exerciseName
            )

            // One rest runs at a time. Updating the live one rather than
            // requesting a second keeps the Dynamic Island from stacking
            // activities when sets are ticked off quickly.
            if let running = Activity<RestTimerAttributes>.activities.first {
                Task {
                    await running.update(
                        ActivityContent(state: state, staleDate: state.endsAt)
                    )
                }
                return true
            }

            do {
                _ = try Activity.request(
                    attributes: RestTimerAttributes(workoutName: workoutName),
                    // staleDate lets the system grey the countdown out if the
                    // app dies without ending the activity.
                    content: ActivityContent(state: state, staleDate: state.endsAt),
                    pushType: nil
                )
                return true
            } catch {
                return false
            }
        }

        Function("end") { () -> Void in
            guard #available(iOS 16.2, *) else { return }
            Task {
                for activity in Activity<RestTimerAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
        }
    }
}
