import AppKit
import Foundation

let repositoryRoot = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .deletingLastPathComponent()

func image(at path: String) throws -> NSImage {
    let url = repositoryRoot.appending(path: path)
    guard let image = NSImage(contentsOf: url) else {
        throw NSError(domain: "NotifAiAssets", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not open \(path)"])
    }
    return image
}

func bitmap(_ image: NSImage, width: Int, height: Int, circular: Bool = false) throws -> NSBitmapImageRep {
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: width,
        pixelsHigh: height,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ), let context = NSGraphicsContext(bitmapImageRep: rep) else {
        throw NSError(domain: "NotifAiAssets", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not create a \(width) × \(height) bitmap"])
    }

    let bounds = NSRect(x: 0, y: 0, width: width, height: height)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    if circular { NSBezierPath(ovalIn: bounds).addClip() }
    NSColor.clear.set()
    bounds.fill()
    image.draw(
        in: bounds,
        from: NSRect(origin: .zero, size: image.size),
        operation: .copy,
        fraction: 1,
        respectFlipped: false,
        hints: [.interpolation: NSImageInterpolation.high]
    )
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()
    return rep
}

func savePNG(_ image: NSImage, width: Int, height: Int, path: String, circular: Bool = false) throws {
    let rep = try bitmap(image, width: width, height: height, circular: circular)
    let data = rep.representation(using: .png, properties: [:])!
    try data.write(to: repositoryRoot.appending(path: path), options: .atomic)
}

func saveJPEG(_ image: NSImage, width: Int, height: Int, path: String) throws {
    let rep = try bitmap(image, width: width, height: height)
    let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.94])!
    try data.write(to: repositoryRoot.appending(path: path), options: .atomic)
}

let icon = try image(at: "web/public/icon.svg")
let featureGraphic = try image(at: "assets/google-play/feature-graphic-1024x500.svg")

try savePNG(icon, width: 512, height: 512, path: "assets/google-play/app-icon-512.png")
try saveJPEG(icon, width: 512, height: 512, path: "web/public/notifai_app_icon.jpg")
try savePNG(icon, width: 512, height: 512, path: "android/app/src/main/res/drawable/ic_launcher_web.png")
try savePNG(icon, width: 256, height: 256, path: "android/app/src/main/res/drawable/ic_notifai_mark.png")
try saveJPEG(featureGraphic, width: 1024, height: 500, path: "assets/google-play/feature-graphic-1024x500.jpg")
try saveJPEG(featureGraphic, width: 1024, height: 500, path: "web/public/notifai_feature_graphic.jpg")

let launcherSizes = [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]
for (density, size) in launcherSizes {
    let directory = "android/app/src/main/res/mipmap-\(density)"
    try savePNG(icon, width: size, height: size, path: "\(directory)/ic_launcher.png")
    try savePNG(icon, width: size, height: size, path: "\(directory)/ic_launcher_round.png", circular: true)
}

print("Exported Play Store artwork, web icons, and Android launcher PNGs.")
