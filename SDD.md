# System Design Document (SDD)
## Application Name: Aura
**Platform:** iOS (Primary)
**Framework:** React Native (TypeScript)
**Core Value Proposition:** Professional-grade, completely offline video color grading and filtering via an ultra-fluid, gesture-driven interface.

---

## 1. Architectural Overview & Tech Stack

Aura is a completely offline, local-first video editing application. All video processing, rendering, and state management occur on the device without requiring network requests. 

### 1.1 Core Technologies
*   **Framework:** React Native (latest stable).
*   **Graphics & Rendering Engine:** `@shopify/react-native-skia` for high-performance, GPU-accelerated 2D graphics, gradients, and custom UI components (sliders, splash screen, filter ribbons).
*   **Animation Engine:** `react-native-reanimated` (v3) for 60/120fps UI thread animations, physics-based springs, and shared-value gesture tracking.
*   **Gesture Handling:** `react-native-gesture-handler` for continuous, fluid touch interactions (Pan, Pinch, LongPress).
*   **Video Playback:** `react-native-video` (with custom native iOS bindings for real-time shader/filter application).
*   **Video Processing Engine:** `ffmpeg-kit-react-native` for applying complex 3D LUTs (Look-Up Tables) and exporting the final video completely offline.
*   **State Management:** `zustand` for lightweight, unopinionated global state (selected video, current filter, export progress).
*   **Iconography:** `lucide-react-native` (SVG-based vector icons).
*   **Local Storage:** `react-native-mmkv` for lightning-fast, synchronous key-value storage (user preferences, custom filter presets).

---

## 2. UI/UX Philosophy & Design Language

Aura takes inspiration from modern, frictionless apps like Telegram and Threads. The interface is nearly invisible; the content (the video) is the UI. 

### 2.1 Design System
*   **Theme:** Pure Dark Mode exclusively. Minimizes eye strain and provides an accurate backdrop for color grading.
    *   Background: `#000000` (Pure Black)
    *   Surface Levels: `#0A0A0A`, `#141414`, `#1C1C1C`
    *   Text: `#FFFFFF` (Primary), `#8E8E93` (Secondary, iOS standard)
    *   Accent/Brand: Contextual. The accent color dynamically morphs based on the dominant color of the currently applied filter (extracted via Skia).
*   **Typography:** San Francisco Pro (iOS System Font). Heavy use of `SF Pro Display` for headers and `SF Pro Text` for subtle labels. No text clutter; iconography and gestures replace text buttons where possible.
*   **Haptics:** Deeply integrated using `expo-haptics` or `react-native-haptic-feedback`.
    *   *Light Impact:* Scrolling through filters.
    *   *Medium Impact:* Snapping to a timeline marker or returning to the 0-point on a slider.
    *   *Heavy Impact:* Successful video export or confirming deletion.

### 2.2 Global Gesture Matrix
Instead of back buttons and modal close buttons, Aura relies on physics-based swipe gestures:
*   **Swipe Right from Left Edge:** Global "Go Back" / "Pop Screen".
*   **Swipe Down:** Dismiss currently active modal, filter drawer, or export screen.
*   **Two-Finger Pinch:** Zoom out of timeline to see entire video length.
*   **Two-Finger Spread:** Zoom into timeline for frame-accurate adjustments.
*   **Long Press:** Activate preview mode (temporarily bypasses filter to show original video).

---

## 3. Screen Breakdown & Component Specifications

### 3.1 The Splash Screen (The "Aura Shatter" Effect)
**Purpose:** Create an immediate, breathtaking first impression while the RN bridge initializes and local video library permissions are checked.

*   **UI Components:** 
    *   A pure black background.
    *   The word "AURA" rendered in the center using `@shopify/react-native-skia` Text module, styled with a shimmering glassmorphism gradient (simulated using Skia shaders).
*   **Animation Choreography (Reanimated + Skia):**
    1.  **Initial State:** The text "AURA" sits perfectly still.
    2.  **The Trigger (T+400ms):** A physics-based "shatter" event begins. The text is actually composed of dozens of individual Skia polygon paths.
    3.  **The Physics:** Using `withSpring` (high velocity, low damping), the polygons violently explode outward.
    4.  **The Vortex:** Immediately after expanding, a rotation matrix is applied to the Skia canvas. The shattered glass pieces rapidly twist into a tight spiral, turning into a glowing, multi-colored ring.
    5.  **The Transition:** The ring expands rapidly toward the camera (scaling up), blurring out via a Skia `Blur` mask, seamlessly fading the background into the Home Library screen.

### 3.2 Home Screen (Video Library)
**Purpose:** Grid display of device videos, ready for import.

*   **UI Layout:**
    *   **Top Bar:** Blur-backed (iOS `UIBlurEffect`) sticky header. Title "Library" aligned to the left. A vector icon (Settings wheel) on the right.
    *   **Grid:** FlatList/FlashList of video thumbnails (3 columns).
*   **UX/Interactions:**
    *   **Pinch to resize:** Users can pinch the screen to change the grid from 3 columns to 5 columns or 1 column (full width). The transition is animated using Reanimated shared values mapped to the column width.
    *   **Scrolling:** As the user scrolls, the top header dynamically blurs the videos passing underneath it.
*   **Components:**
    *   `LibraryCard`: An image component displaying the video thumbnail. Rounded corners (`borderRadius: 12`).
    *   `DurationBadge`: Absolutely positioned bottom-right of `LibraryCard`. Translucent black background, white text (e.g., "0:14").

### 3.3 The Core Editor Screen (The Main Workspace)
**Purpose:** The killer-feature screen. Where users apply, tweak, and preview color filters.

*   **UI Layout:**
    *   **Viewport (Top 65%):** Borderless video player. The video fills the width completely.
    *   **Control Deck (Bottom 35%):** The gesture zone. Contains the Skia Filter Ribbon, Intensity Slider, and Timeline Scrubber.
*   **Components & Animations:**

    #### A. The Video Viewport
    *   Uses `react-native-video`. 
    *   **Gesture:** Swiping horizontally directly on the video viewport instantly transitions between the current filter and the adjacent filter. The transition is a "wipe" effect—as the finger drags, a vertical Skia line tracks the finger, revealing the new filter on the left and the old filter on the right.

    #### B. The "Aura Ribbon" (Filter Selector)
    *   This replaces traditional discrete square buttons for filters.
    *   **Visuals:** Rendered entirely in React Native Skia. It appears as a continuous, horizontal ribbon of flowing, blended colors representing different 3D LUT profiles (e.g., a warm orange/teal section for cinematic, a desaturated blue section for melancholic).
    *   **Interaction:** A `PanGestureHandler`. As the user swipes the ribbon left/right, it scrolls infinitely. 
    *   **Mechanics:** A vertical white vector line (the "Playhead") sits in the middle of the ribbon. Whichever color on the ribbon intersects the playhead determines the filter applied to the video above.
    *   **Haptics:** A light haptic tick fires every time a new distinct filter zone crosses the playhead.

    #### C. The Intensity Slider
    *   Appears dynamically when a user taps on the active filter name above the ribbon.
    *   **Visuals:** A minimalist Skia-drawn line. No "thumb" or "knob" exists. The user simply drags their finger anywhere horizontally in the slider's bounding box.
    *   **Animation:** The line fills with the active filter's dominant color as the intensity increases from 0 to 100%. If pulled below 0 or above 100%, a Reanimated spring provides rubber-band resistance.

    #### D. Timeline Scrubber (Hidden by default)
    *   **UX:** To keep the screen clean, the timeline scrubber is accessed by swiping UP from the bottom edge of the screen. 
    *   **Animation:** The Control Deck slides down, and the Timeline Scrubber elegantly rises via `withSpring`. It displays a strip of remote image thumbnails (simulating extracted video frames, e.g., `https://images.pexels.com/photos/12345/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=200`).

### 3.4 Export / Render Screen
**Purpose:** Process the video with FFmpeg offline and save it to the camera roll.

*   **UI Layout:**
    *   Completely immersive modal that slides up from the bottom.
    *   Background: Deep translucent gray with background blur.
    *   Center: A massive, gorgeous Skia-based progress ring.
*   **Components & Animations:**
    *   `ProgressRing`: A glowing circle rendered with Skia. As FFmpeg reports progress (0-100%), the stroke of the circle fills. 
    *   **Particle Effect:** Inside the ring, Skia particles (small glowing dots) float upwards. The speed of the particles maps directly to the rendering speed—faster rendering makes the particles fly faster.
    *   **Completion:** When progress hits 100%, the ring violently collapses into a single dot, which then bursts into a checkmark vector icon (Lucide `Check` icon).
    *   **Swipe to Cancel:** During export, swiping down heavily on the screen will rubber-band the entire modal. If dragged past a threshold (Y > 200), the export cancels, and the modal dismisses.

---

## 4. Specific Animation & Interaction Implementation Details

### 4.1 Gesture-Driven Navigation (The Telegram/Threads Feel)
To achieve the fluid, non-blocking feel of modern apps, navigation relies on `react-native-gesture-handler` wrapping the main screen containers.
*   **Shared Values:** Screen X and Y translations are bound to `useSharedValue(0)`.
*   **Animated Styles:** Components use `useAnimatedStyle` to map the shared values to `transform: [{ translateX }]` or `transform: [{ translateY }]`.
*   **Interpolation:** As a screen is dragged to the right to go back, the opacity of the current screen interpolates from `1` to `0`, while the scale of the screen underneath interpolates from `0.9` to `1.0` (simulating depth).

### 4.2 The Filter Transition Engine
Applying a color filter requires mapping a 3D LUT to the video frames. 
*   **Preview Mode:** To maintain 60fps while scrolling the Aura Ribbon, the app uses simplified Skia `ColorMatrix` shaders overlaid on the video component for real-time previews. 
*   **Render Mode:** Once the user is satisfied and hits Export, `ffmpeg-kit-react-native` takes over, applying a true `.cube` LUT file to the video file completely offline in the background thread.

---

## 5. Graphics and Assets Strategy

As per the stringent requirements, **no native emojis are used anywhere in the application.**

*   **System Icons:** All UI icons (Play, Pause, Export, Settings, Back, Check, X) are implemented using `lucide-react-native`. These are scalable, stroke-based SVGs that match the precise stroke width of iOS system icons (usually 1.5pt to 2pt).
*   **Placeholder/Demo Media:** During onboarding or when demonstrating filter capabilities before library permission is granted, the app fetches royalty-free standard assets.
    *   *Example Video Poster Image:* `https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1000&auto=format&fit=crop`
    *   *Example Timeline Frames:* Generated dynamically appending different width/height parameters to `https://source.unsplash.com/random/`.
*   **Asset Loading:** All remote images utilize a caching library (e.g., `react-native-fast-image` mechanisms) with a Skia-based skeleton loader (a shimmering gray block) displayed while the remote asset loads.

---

## 6. Data Flow & Local State Management

Because Aura is an entirely offline application, data flow is highly optimized for local device memory.

1.  **Selection:** User selects video via `expo-media-library`.
2.  **Metadata Extraction:** App extracts duration, resolution, and frame rate. Stored temporarily in a Zustand store.
3.  **Workspace State:** Zustand holds:
    *   `currentVideoUri`: string (local file path)
    *   `activeFilterId`: string (references a local preset)
    *   `filterIntensity`: number (0.0 to 1.0)
    *   `currentTime`: number (playback position)
4.  **Persistence:** Custom user-created filters (combinations of color matrices) are serialized to JSON and stored instantly via `react-native-mmkv`.
5.  **Export Hand-off:** On export, Zustand state is translated into an FFmpeg execution command. 
    *   *Example Command Structure:* `-i local_video.mp4 -vf "lut3d=filters/vintage.cube" -c:a copy output.mp4`
6.  **Cleanup:** Upon successful save to camera roll, the temporary `output.mp4` in the app's cache directory is deleted to preserve user device storage.