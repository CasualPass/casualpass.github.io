import SwiftUI

@main
struct CasualPassApp: App {
    var body: some Scene {
        WindowGroup {
            BrowserView().background(Color(red: 16 / 255, green: 18 / 255, blue: 15 / 255))
        }
    }
}

struct BrowserView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> BrowserController { BrowserController() }
    func updateUIViewController(_ controller: BrowserController, context: Context) {}
}
