import UIKit
import WebKit

final class BrowserController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    static let home = URL(string: "https://casualpass.github.io/")!
    private var web: WKWebView!
    private let errorPanel = UIStackView()
    private var saveHandler: SaveHandler!
    private var navigationFailed = false

    static func trusted(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme == "https" && url.host == "casualpass.github.io" && (url.port == nil || url.port == 443) && url.user == nil
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 16 / 255, green: 18 / 255, blue: 15 / 255, alpha: 1)
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.limitsNavigationsToAppBoundDomains = true
        saveHandler = SaveHandler(owner: self)
        configuration.userContentController.addScriptMessageHandler(saveHandler, contentWorld: .page, name: "casualpassSave")
        configuration.applicationNameForUserAgent = "CasualPassiOS/1.0.0"
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.customUserAgent = nil // Keep WebKit's capabilities and add only a shell marker.
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = view.backgroundColor
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
        let message = UILabel()
        message.text = "CasualPass açılamadı.\nİlk açılışta internet gerekir. Daha önce kaydedilen oyunlar çevrimdışı açılabilir."
        message.textColor = .white; message.numberOfLines = 0; message.textAlignment = .center
        let retry = UIButton(type: .system)
        retry.setTitle("Yeniden dene", for: .normal)
        retry.addTarget(self, action: #selector(reloadHome), for: .touchUpInside)
        errorPanel.axis = .vertical; errorPanel.spacing = 20
        errorPanel.addArrangedSubview(message); errorPanel.addArrangedSubview(retry)
        errorPanel.translatesAutoresizingMaskIntoConstraints = false
        errorPanel.backgroundColor = view.backgroundColor
        view.addSubview(errorPanel)
        NSLayoutConstraint.activate([
            errorPanel.centerXAnchor.constraint(equalTo: view.centerXAnchor), errorPanel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            errorPanel.widthAnchor.constraint(lessThanOrEqualToConstant: 340), errorPanel.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24)
        ])
        errorPanel.isHidden = true
        web.load(URLRequest(url: Self.home))
    }

    @objc private func reloadHome() { errorPanel.isHidden = true; web.load(URLRequest(url: Self.home)) }
    private func external(_ url: URL) {
        guard ["https", "mailto"].contains(url.scheme ?? "") else { return }
        UIApplication.shared.open(url)
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if Self.trusted(url) {
            if action.targetFrame == nil { webView.load(action.request); decisionHandler(.cancel) }
            else { decisionHandler(.allow) }
        } else { if action.targetFrame?.isMainFrame != false { external(url) }; decisionHandler(.cancel) }
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { navigationFailed = false; errorPanel.isHidden = true }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { if !navigationFailed { errorPanel.isHidden = true } }
    private func failed(_ error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        navigationFailed = true; errorPanel.isHidden = false
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard Self.trusted(frame.request.url), presentedViewController == nil else { completionHandler(false); return }
        let alert = UIAlertController(title: "CasualPass", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Vazgeç", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "Devam et", style: .default) { _ in completionHandler(true) }); present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        guard Self.trusted(frame.request.url), presentedViewController == nil else { completionHandler(); return }
        let alert = UIAlertController(title: "CasualPass", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Tamam", style: .default) { _ in completionHandler() }); present(alert, animated: true)
    }

    fileprivate func exportSave(_ text: String, reply: @escaping (Any?, String?) -> Void) {
        guard Self.trusted(web.url), text.utf8.count <= 131072, let data = text.data(using: .utf8),
              let save = try? JSONSerialization.jsonObject(with: data) as? [String: Any], save["format"] as? String == "casualpass-save", presentedViewController == nil else {
            reply(nil, "Kayıt dosyası açılamadı."); return
        }
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let file = folder.appendingPathComponent("casualpass-kayit.json")
        do { try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true); try data.write(to: file, options: .atomic) }
        catch { reply(nil, "Kayıt dosyası oluşturulamadı."); return }
        let share = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        share.popoverPresentationController?.sourceView = view
        share.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        share.completionWithItemsHandler = { _, completed, _, error in
            try? FileManager.default.removeItem(at: folder)
            if let error { reply(nil, error.localizedDescription) } else { reply(["cancelled": !completed], nil) }
        }
        present(share, animated: true)
    }
}

final class SaveHandler: NSObject, WKScriptMessageHandlerWithReply {
    weak var owner: BrowserController?
    init(owner: BrowserController) { self.owner = owner }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https", origin.host == "casualpass.github.io", origin.port == 0 || origin.port == 443,
              let text = message.body as? String, let owner else { replyHandler(nil, "İzin verilmeyen kaynak."); return }
        owner.exportSave(text, reply: replyHandler)
    }
}
