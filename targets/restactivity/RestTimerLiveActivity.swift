import ActivityKit
import WidgetKit
import SwiftUI

/// Rest-timer Live Activity.
///
/// The shape below MUST stay identical to the copy in
/// modules/rest-activity/ios/RestActivityModule.swift. The two targets compile
/// separately and ActivityKit matches them by structure, so a field added to
/// one and not the other fails at runtime, not at build time.
struct RestTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// Start and end of the rest, as wall-clock instants.
        ///
        /// The countdown is handed to the system as a range rather than as a
        /// number of seconds we keep pushing: SwiftUI's timer text ticks on its
        /// own, so the display stays right while the app is suspended, which is
        /// the whole point of showing it here.
        var startedAt: Date
        var endsAt: Date
        var exerciseName: String
    }

    /// Fixed for the life of the activity.
    var workoutName: String
}

private let goldVivid = Color(red: 0.89, green: 0.63, blue: 0.03)
private let navy = Color(red: 0.05, green: 0.14, blue: 0.25)

/// The ticking m:ss.
///
/// `showsHours: false` matters: with it on (the default) the timer text lays
/// itself out wide enough for `0:00:00`, which does not fit the Dynamic
/// Island's compact and trailing slots and gets clipped to an ellipsis. Rests
/// are never an hour long. The scale factor is a backstop so a long rest
/// shrinks rather than clips.
private struct Countdown: View {
    let state: RestTimerAttributes.ContentState
    var font: Font

    var body: some View {
        Text(timerInterval: state.startedAt...state.endsAt, countsDown: true, showsHours: false)
            .font(font.monospacedDigit())
            .foregroundColor(goldVivid)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
    }
}

/// Full at the start of the rest, drains to empty as it ends. The system
/// animates it, so it keeps moving while the app is suspended.
private struct RestBar: View {
    let state: RestTimerAttributes.ContentState

    var body: some View {
        ProgressView(timerInterval: state.startedAt...state.endsAt, countsDown: true) {
            EmptyView()
        } currentValueLabel: {
            EmptyView()
        }
        .progressViewStyle(.linear)
        .tint(goldVivid)
    }
}

struct RestTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestTimerAttributes.self) { context in
            // Lock screen and banner.
            HStack(spacing: 14) {
                Image(systemName: "timer")
                    .font(.title2)
                    .foregroundColor(goldVivid)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Resting")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(context.state.exerciseName)
                        .font(.headline)
                        .lineLimit(1)
                }

                Spacer()

                Countdown(state: context.state, font: .system(.title, design: .rounded))
                    .frame(maxWidth: 90, alignment: .trailing)
            }
            .padding()
            .activityBackgroundTint(navy.opacity(0.92))
            .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in
            DynamicIsland {
                // The leading and trailing regions are narrow columns either
                // side of the sensor housing, so each holds one small thing.
                // Anything wider is clipped against the outside edge, which is
                // what an icon paired with a label did here.
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "timer")
                        .font(.title3)
                        .foregroundColor(goldVivid)
                        .padding(.leading, 2)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Countdown(state: context.state, font: .system(.title2, design: .rounded).weight(.semibold))
                        .frame(maxWidth: 72, alignment: .trailing)
                        .padding(.trailing, 2)
                }
                // Bottom spans the full width under the housing, so everything
                // with a real width belongs here.
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("RESTING")
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(.secondary)
                        Text(context.state.exerciseName)
                            .font(.headline)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        RestBar(state: context.state)
                        Text(context.attributes.workoutName)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 4)
                    .padding(.top, 2)
                }
            } compactLeading: {
                // The compact presentation is two views flanking the camera,
                // and the pill has to wrap the housing either way — so an
                // empty leading slot does not shrink the island, it just
                // leaves a gap. A ring of the time remaining fills it with
                // something worth the space.
                ProgressView(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true) {
                    EmptyView()
                } currentValueLabel: {
                    EmptyView()
                }
                .progressViewStyle(.circular)
                .tint(goldVivid)
            } compactTrailing: {
                Countdown(state: context.state, font: .system(.body, design: .rounded).weight(.semibold))
                    .frame(maxWidth: 56)
            } minimal: {
                Countdown(state: context.state, font: .system(size: 11, weight: .semibold, design: .rounded))
                    .frame(maxWidth: 34)
            }
            .keylineTint(goldVivid)
        }
    }
}
