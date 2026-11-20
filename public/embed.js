/**
 * WordPress embed. Finds the placeholder, then loads the map in an iframe
 * only when it is near the screen. The iframe is what keeps the shop's
 * theme CSS (and its "hide every iframe" rule) from restyling the locator.
 */
(function () {
  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf("/embed.js") !== -1) {
        script = scripts[i];
        break;
      }
    }
  }
  if (!script) return;
  var origin = new URL(script.src, window.location.href).origin;
  var roots = document.querySelectorAll("#form-store-locator, [data-form-store-locator]");

  function mount(root) {
    if (root.getAttribute("data-mounted") === "1") return;
    root.setAttribute("data-mounted", "1");
    root.textContent = "";
    root.style.display = "block";
    root.style.minHeight = "0";

    var frame = document.createElement("iframe");
    frame.className = "form-store-locator-frame";
    frame.title = "Store locator";
    frame.setAttribute("allow", "geolocation");
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    // The Form theme hides iframes with !important. An inline !important wins.
    frame.style.setProperty("display", "block", "important");
    frame.style.setProperty("width", "100%", "important");
    frame.style.setProperty("max-width", "100%", "important");
    frame.style.setProperty("border", "0", "important");
    frame.style.setProperty("height", "600px", "important");
    frame.style.setProperty("background", "#fff", "important");
    frame.style.setProperty("color-scheme", "light", "important");
    frame.src = origin + "/embed";

    window.addEventListener("message", function (event) {
      if (event.origin !== origin) return;
      if (event.source !== frame.contentWindow) return;
      var data = event.data;
      if (!data || data.type !== "form-locator-height") return;
      var height = Number(data.height);
      if (height > 200 && height < 20000) {
        frame.style.setProperty("height", Math.ceil(height) + "px", "important");
      }
    });

    root.appendChild(frame);
  }

  function arm(root) {
    root.style.display = "block";
    root.style.minHeight = window.matchMedia("(max-width: 699px)").matches ? "480px" : "600px";
    if (!("IntersectionObserver" in window)) {
      mount(root);
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          mount(root);
        });
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(root);
  }

  roots.forEach(arm);
})();
