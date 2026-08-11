import React, { useState, useRef, useCallback, useEffect } from "react";

// ── Icon paths ─────────────────────────────────────────────────────────────────
const PUZZLE_ICON = "M12.5 2A2.5 2.5 0 0 0 10 4.5c0 .28.05.55.14.8L8.8 6.65a2.77 2.77 0 0 0-.8-.15H6.5v1.5h1.5c.77 0 1.5.28 2.07.86l.79.79-.79.79a2.78 2.78 0 0 0-.85 2.01v1.5h1.5v-1.5c0-.28.05-.55.14-.8l1.35-1.35c.24.09.51.14.79.14a2.5 2.5 0 0 0 0-5zM3 5.5A1.5 1.5 0 0 1 4.5 4H6V2H4.5a3.5 3.5 0 0 0-3.5 3.5V7h2V5.5zM1 8v4.5A3.5 3.5 0 0 0 4.5 16H7v-2H4.5A1.5 1.5 0 0 1 3 12.5V8H1z";

// ── Shared extension icon ──────────────────────────────────────────────────────
const ExtIcon = ({ ext, size = 28 }) => {
  if (ext.iconDataUrl) {
    return (
      <img src={ext.iconDataUrl} alt="" width={size} height={size}
        style={{ borderRadius: 4, objectFit: "contain", flexShrink: 0 }}
        onError={(e) => { e.currentTarget.style.display = "none"; }} />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 4, background: "#3a3a3a",
      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={Math.round(size * 0.57)} height={Math.round(size * 0.57)}
        viewBox="0 0 16 16" fill="#888"><path d={PUZZLE_ICON} /></svg>
    </div>
  );
};

// ── Extension Manager Modal ────────────────────────────────────────────────────
const ExtensionManager = ({ onClose }) => {
  const [extensions, setExtensions] = useState([]);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState(null);

  const reload = () =>
    window.electronAPI.readExtensions().then((list) => {
      if (Array.isArray(list)) setExtensions(list);
    });

  useEffect(() => { reload(); }, []); // eslint-disable-line

  const handleUpload = async () => {
    setError(null); setUploading(true);
    try {
      const fp = await window.electronAPI.pickExtensionFile();
      if (!fp) return;
      const name = fp.replace(/.*[\\/]/, "").replace(/\.(zip|crx)$/i, "");
      const res  = await window.electronAPI.uploadExtension(name, fp);
      if (res?.success) setExtensions((p) => [...p, res.entry]);
      else setError(res?.error || "Upload failed");
    } catch (e) { setError(e?.message || "Upload failed"); }
    finally { setUploading(false); }
  };

  const handleLoadUnpacked = async () => {
    setError(null); setUploading(true);
    try {
      const res = await window.electronAPI.loadUnpackedExtension();
      if (res?.canceled) return;
      if (res?.success) setExtensions((p) => [...p, res.entry]);
      else setError(res?.error || "Failed");
    } catch (e) { setError(e?.message || "Failed"); }
    finally { setUploading(false); }
  };

  const handleToggle = async (id) => {
    const res = await window.electronAPI.toggleExtension(id);
    if (res?.success) setExtensions((p) => p.map((x) => x.id === id ? res.entry : x));
    else setError(res?.error || "Toggle failed");
  };

  const handleDelete = async (id) => {
    await window.electronAPI.deleteExtension(id);
    setExtensions((p) => p.filter((x) => x.id !== id));
  };

  return (
    <>
      <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.55)" }} onClick={onClose} />
      <div style={{ position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
        zIndex:1001,width:520,maxHeight:"78vh",background:"#1e1e1e",border:"1px solid #3a3a3a",
        borderRadius:6,display:"flex",flexDirection:"column",boxShadow:"0 8px 32px rgba(0,0,0,0.6)",overflow:"hidden" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"12px 16px",borderBottom:"1px solid #2d2d2d",background:"#252526",flexShrink:0 }}>
          <span style={{ fontWeight:600,fontSize:13,color:"#d0d0d0" }}>Extension Manager</span>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:18,lineHeight:1 }} aria-label="Close">×</button>
        </div>

        {/* Add buttons */}
        <div style={{ padding:"12px 16px",borderBottom:"1px solid #2d2d2d",flexShrink:0 }}>
          <p style={{ fontSize:11,color:"#888",margin:"0 0 8px" }}>
            Install a <strong style={{color:"#bbb"}}>.zip</strong> / <strong style={{color:"#bbb"}}>.crx</strong> file,
            or load an unpacked folder containing <code style={{color:"#bbb",fontSize:10}}>manifest.json</code>.
          </p>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            <button onClick={handleUpload} disabled={uploading}
              style={{ height:30,padding:"0 14px",background:uploading?"#2a2a2a":"#0e639c",
                border:"1px solid "+(uploading?"#3a3a3a":"#1177bb"),borderRadius:3,
                color:uploading?"#666":"#d0d0d0",fontSize:12,cursor:uploading?"default":"pointer",
                display:"inline-flex",alignItems:"center",gap:6 }}>
              {uploading ? "Installing…" : "+ Add .zip / .crx"}
            </button>
            <button onClick={handleLoadUnpacked} disabled={uploading}
              title="Select a folder with manifest.json"
              style={{ height:30,padding:"0 14px",background:"#252526",
                border:"1px solid #3a3a3a",borderRadius:3,
                color:"#c8c8c8",fontSize:12,cursor:"pointer",
                display:"inline-flex",alignItems:"center",gap:6 }}>
              📂 Load Unpacked
            </button>
          </div>
          {error && <div style={{ marginTop:6,fontSize:11,color:"#f44747" }}><strong>Error:</strong> {error}</div>}
        </div>

        {/* List */}
        <div style={{ flex:1,overflowY:"auto",padding:"4px 0" }}>
          {extensions.length === 0
            ? <div style={{ padding:"28px 16px",textAlign:"center",color:"#555",fontSize:12,fontStyle:"italic" }}>No extensions installed.</div>
            : extensions.map((ex) => (
              <div key={ex.id} style={{ display:"flex",alignItems:"flex-start",padding:"10px 16px",
                gap:12,borderBottom:"1px solid #2a2a2a",opacity:ex.enabled?1:0.55 }}>
                <ExtIcon ext={ex} size={36} />
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap" }}>
                    <span style={{ fontSize:12,color:"#d0d0d0",fontWeight:600 }}>{ex.name}</span>
                    <span style={{ fontSize:10,color:"#666" }}>v{ex.version}</span>
                  </div>
                  {ex.description && (
                    <div style={{ fontSize:11,color:"#888",marginTop:2,lineHeight:1.4 }}>
                      {ex.description.length > 100 ? ex.description.slice(0,100)+"…" : ex.description}
                    </div>
                  )}
                  {ex.loadError && (
                    <div style={{ marginTop:4,fontSize:10,color:"#f44747",
                      background:"rgba(244,71,71,0.08)",borderRadius:3,padding:"2px 6px",display:"inline-block" }}>
                      ⚠ {ex.loadError}
                    </div>
                  )}
                  {ex.unsupportedPermissions?.length > 0 && (
                    <div style={{ marginTop:3,fontSize:10,color:"#e6a23c" }}>
                      Unsupported: {ex.unsupportedPermissions.join(", ")}
                    </div>
                  )}
                </div>
                {/* Toggle */}
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0 }}>
                  <button onClick={() => handleToggle(ex.id)} role="switch" aria-checked={ex.enabled}
                    title={ex.enabled?"Disable":"Enable"}
                    style={{ position:"relative",width:32,height:18,borderRadius:9,border:"none",
                      background:ex.enabled?"#0e639c":"#3a3a3a",cursor:"pointer",padding:0,transition:"background 0.15s" }}>
                    <span style={{ position:"absolute",top:3,left:ex.enabled?16:3,width:12,height:12,
                      borderRadius:"50%",background:"#fff",transition:"left 0.15s" }} />
                  </button>
                  <span style={{ fontSize:9,color:ex.enabled?"#4ec9b0":"#555" }}>{ex.enabled?"on":"off"}</span>
                </div>
                {/* Delete */}
                <button onClick={() => handleDelete(ex.id)} title="Remove"
                  style={{ background:"none",border:"none",color:"#555",cursor:"pointer",
                    padding:4,borderRadius:3,display:"flex",alignItems:"center",flexShrink:0,alignSelf:"flex-start" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color="#f44747"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color="#555"; }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/>
                  </svg>
                </button>
              </div>
            ))
          }
        </div>

        {/* Footer */}
        <div style={{ padding:"10px 16px",borderTop:"1px solid #2d2d2d",background:"#252526",flexShrink:0,display:"flex",justifyContent:"flex-end" }}>
          <button onClick={onClose}
            style={{ height:28,padding:"0 14px",background:"#2d2d2d",border:"1px solid #3a3a3a",
              borderRadius:3,color:"#bbb",fontSize:12,cursor:"pointer" }}>Close</button>
        </div>
      </div>
    </>
  );
};

// ── Extension Action Dropdown ──────────────────────────────────────────────────
const ExtDropdown = ({ extensions, anchorRef, onClose, onOpenPopup }) => {
  const [pos, setPos] = useState({ right: 8, top: 70 });

  useEffect(() => {
    if (anchorRef?.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ right: Math.max(4, window.innerWidth - r.right), top: r.bottom + 4 });
    }
  }, [anchorRef]);

  return (
    <>
      <div style={{ position:"fixed",inset:0,zIndex:900 }} onClick={onClose} />
      <div style={{ position:"fixed",zIndex:901,minWidth:260,maxWidth:320,
        background:"#2a2a2a",border:"1px solid #3a3a3a",borderRadius:6,
        boxShadow:"0 4px 20px rgba(0,0,0,0.5)",overflow:"hidden",
        right:pos.right,top:pos.top }}>
        <div style={{ padding:"9px 14px 6px",borderBottom:"1px solid #333",
          fontSize:10,fontWeight:700,color:"#777",textTransform:"uppercase",letterSpacing:"0.07em" }}>
          Extensions
        </div>
        {extensions.length === 0
          ? <div style={{ padding:"16px 14px",color:"#555",fontSize:12,fontStyle:"italic" }}>No active extensions.</div>
          : <div style={{ maxHeight:340,overflowY:"auto" }}>
              {extensions.map((ex) => (
                <button key={ex.id} onClick={() => { onOpenPopup(ex); onClose(); }}
                  disabled={!ex.enabled || !!ex.loadError}
                  style={{ display:"flex",alignItems:"center",width:"100%",
                    padding:"8px 14px",gap:10,cursor:ex.enabled?"pointer":"default",
                    borderBottom:"1px solid #333",border:"none",
                    background:"transparent",textAlign:"left",opacity:ex.enabled?1:0.45 }}
                  onMouseEnter={(e) => { if (ex.enabled) e.currentTarget.style.background="#333"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background="transparent"; }}>
                  <ExtIcon ext={ex} size={24} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:12,color:ex.loadError?"#e6a23c":"#d0d0d0",
                      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{ex.name}</div>
                    <div style={{ fontSize:10,color:"#555",marginTop:1 }}>
                      {ex.loadError?"Load error":ex.enabled?`v${ex.version}`:"Disabled"}
                    </div>
                  </div>
                  {ex.enabled && !ex.loadError && (
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none"
                      stroke="#555" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 3l5 5-5 5"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
        }
        <div style={{ padding:"8px 14px",borderTop:"1px solid #333" }}>
          <button onClick={() => { window.dispatchEvent(new CustomEvent("browser:openExtMgr")); onClose(); }}
            style={{ width:"100%",height:28,background:"none",border:"1px solid #3a3a3a",
              borderRadius:3,color:"#999",fontSize:11,cursor:"pointer",textAlign:"left",paddingLeft:8 }}
            onMouseEnter={(e) => { e.currentTarget.style.background="#333"; e.currentTarget.style.color="#d0d0d0"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background="none"; e.currentTarget.style.color="#999"; }}>
            Manage extensions…
          </button>
        </div>
      </div>
    </>
  );
};

// ── BrowserPanel ───────────────────────────────────────────────────────────────
// Each BrowserPanel instance gets a stable panelId derived from its FlexLayout nodeId.
// It controls a set of WebContentsViews in the main process via browser:* IPC,
// and reports its content-area bounds on every resize so the main process can
// position the active WebContentsView exactly behind this panel's content area.

const BrowserPanel = ({ nodeId }) => {
  // panelId is stable for the lifetime of this panel instance
  const panelId   = useRef("bp_" + (nodeId || Math.random().toString(36).slice(2))).current;

  const [tabs,      setTabs]      = useState([]);
  const [inputVal,  setInputVal]  = useState("https://www.google.com");
  const [focused,   setFocused]   = useState(false);
  const [extMgrOpen,setExtMgrOpen]= useState(false);
  const [extDropOpen,setExtDropOpen]= useState(false);
  const [extensions,setExtensions]= useState([]);
  const [ready,     setReady]     = useState(false);
  const [initErr,   setInitErr]   = useState(null);

  const contentRef = useRef(null);
  const extBtnRef  = useRef(null);
  const rafRef     = useRef(null);

  const activeTab = tabs.find((t) => t.active) || null;

  // Keep input in sync with active tab URL (only when not focused)
  useEffect(() => {
    if (activeTab && !focused) setInputVal(activeTab.url || "");
  }, [activeTab?.url, focused]); // eslint-disable-line

  // ── Report content-area bounds to main ──────────────────────────────────────
  const reportBounds = useCallback(() => {
    if (!contentRef.current) return;
    const r = contentRef.current.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    window.electronAPI.browserSetBounds(panelId, {
      x: Math.round(r.left), y: Math.round(r.top),
      width: Math.round(r.width), height: Math.round(r.height),
    });
  }, [panelId]);

  const scheduleBounds = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => { rafRef.current = null; reportBounds(); });
  }, [reportBounds]);

  // ── Init / destroy ───────────────────────────────────────────────────────────
  useEffect(() => {
    let unsubTabs = null;

    (async () => {
      try {
        unsubTabs = window.electronAPI.onBrowserTabs(({ panelId: pid, tabs: newTabs }) => {
          if (pid !== panelId) return;
          setTabs(newTabs);
          scheduleBounds();
        });
        await window.electronAPI.browserInit(panelId);
        setReady(true);
        // Load extension list for toolbar
        const exts = await window.electronAPI.readExtensions();
        if (Array.isArray(exts)) setExtensions(exts);
        setTimeout(reportBounds, 80);
      } catch (e) {
        setInitErr(e?.message || "Failed to init browser panel");
      }
    })();

    return () => {
      if (unsubTabs) unsubTabs();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.electronAPI.browserDestroy(panelId).catch(() => {});
    };
  }, [panelId]); // eslint-disable-line

  // ── ResizeObserver on content area ──────────────────────────────────────────
  useEffect(() => {
    if (!contentRef.current || !ready) return;
    const ro = new ResizeObserver(scheduleBounds);
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [ready, scheduleBounds]);

  // ── Listen for Extension Manager open from dropdown ──────────────────────
  useEffect(() => {
    const h = () => setExtMgrOpen(true);
    window.addEventListener("browser:openExtMgr", h);
    return () => window.removeEventListener("browser:openExtMgr", h);
  }, []);

  // ── Tab right-click → Extension Manager ─────────────────────────────────────
  useEffect(() => {
    const handler = async (e) => {
      if (e.detail?.nodeId !== nodeId) return;
      const result = await window.electronAPI.browserTabContextMenu();
      if (!result) return;
      switch (result.action) {
        case "settings":         window.dispatchEvent(new CustomEvent("browser:openSettings")); break;
        case "refresh":          { const t = tabs.find((x) => x.active); if (t) window.electronAPI.browserReload(panelId, t.id); break; }
        case "extensionManager": setExtMgrOpen(true); break;
        default: break;
      }
    };
    window.addEventListener("browser:tabContextMenu", handler);
    return () => window.removeEventListener("browser:tabContextMenu", handler);
  }, [nodeId, panelId, tabs]);

  // ── Navigation helpers ───────────────────────────────────────────────────────
  const navigate = useCallback((url) => {
    const t = tabs.find((x) => x.active);
    if (!t) return;
    window.electronAPI.browserNavigate(panelId, t.id, url);
  }, [panelId, tabs]);

  const handleKey = useCallback((e) => {
    if (e.key === "Enter") navigate(inputVal);
  }, [inputVal, navigate]);

  // ── Extension popup ──────────────────────────────────────────────────────────
  const handleExtPopup = useCallback(async (ex) => {
    if (!ex.enabled || ex.loadError) return;
    const res = await window.electronAPI.openExtensionPopup(ex.id, activeTab?.url || "");
    if (!res?.success) console.info(`[browser] popup: ${res?.error}`);
  }, [activeTab]);

  // Re-sync extension list when manager closes
  const handleExtMgrClose = useCallback(() => {
    setExtMgrOpen(false);
    window.electronAPI.readExtensions().then((list) => {
      if (Array.isArray(list)) setExtensions(list);
    });
  }, []);

  const hasAny     = extensions.length > 0;
  const hasEnabled = extensions.some((e) => e.enabled && !e.loadError);

  // ── Error state ──────────────────────────────────────────────────────────────
  if (initErr) {
    return (
      <div className="browser">
        <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",
          flexDirection:"column",gap:8,padding:32 }}>
          <div style={{ fontSize:13,color:"#f44747" }}>Browser failed to initialize</div>
          <div style={{ fontSize:11,color:"#666" }}>{initErr}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="browser">
      {/* ── Tab strip ────────────────────────────────────────────────────── */}
      <div className="browser__tabs">
        <div className="browser__tab-list">
          {tabs.map((t) => (
            <div key={t.id}
              className={"browser__tab" + (t.active ? " browser__tab--active" : "")}
              onClick={() => window.electronAPI.browserSelectTab(panelId, t.id)}
              title={t.title || t.url}>
              {t.favicon
                ? <img src={t.favicon} alt="" width={14} height={14}
                    style={{ borderRadius:2,flexShrink:0 }}
                    onError={(e) => { e.currentTarget.style.display="none"; }} />
                : <svg width="12" height="12" viewBox="0 0 16 16" fill="#555" style={{ flexShrink:0 }}>
                    <rect x="2" y="2" width="12" height="12" rx="1" fillOpacity=".3"/>
                  </svg>
              }
              <span className="browser__tab-title">{t.title || t.url || "New Tab"}</span>
              {t.loading && <div className="browser__tab-spinner"/>}
              <button className="browser__tab-close"
                onClick={(e) => { e.stopPropagation(); window.electronAPI.browserCloseTab(panelId, t.id); }}
                onMouseEnter={(e) => { e.currentTarget.style.background="rgba(255,255,255,0.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background="transparent"; }}>×</button>
            </div>
          ))}
        </div>
        <button className="browser__new-tab"
          onClick={async () => { await window.electronAPI.browserNewTab(panelId, "https://www.google.com"); setTimeout(reportBounds, 60); }}
          title="New tab"
          onMouseEnter={(e) => { e.currentTarget.style.background="rgba(255,255,255,0.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background="transparent"; }}>+</button>
      </div>

      {/* ── Address bar ──────────────────────────────────────────────────── */}
      <div className="browser__bar">
        <button className="browser__btn" disabled={!activeTab?.canGoBack}
          onClick={() => activeTab && window.electronAPI.browserBack(panelId, activeTab.id)} title="Back">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 12L6 8l4-4"/></svg>
        </button>
        <button className="browser__btn" disabled={!activeTab?.canGoForward}
          onClick={() => activeTab && window.electronAPI.browserForward(panelId, activeTab.id)} title="Forward">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 4l4 4-4 4"/></svg>
        </button>
        <button className="browser__btn"
          onClick={() => activeTab && window.electronAPI.browserReload(panelId, activeTab.id)} title="Reload">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 8a6 6 0 0 1 10.47-4M14 8a6 6 0 0 1-10.47 4M9 1l3 3-3 3M7 15l-3-3 3-3"/>
          </svg>
        </button>

        <div className={"browser__url-wrap" + (focused?" browser__url-wrap--focused":"")}>
          {activeTab?.loading && <div className="browser__spinner"/>}
          <input className="browser__url" value={inputVal} spellCheck={false}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKey}
            onFocus={(e) => { setFocused(true); e.currentTarget.select(); }}
            onBlur={() => setFocused(false)}
            placeholder="Search or enter URL" />
        </div>

        {hasAny && (
          <button ref={extBtnRef} className="browser__btn"
            onClick={() => setExtDropOpen((o) => !o)} title="Extensions"
            style={{ color: hasEnabled?"#4ec9b0":"#666",
              background: extDropOpen?"rgba(255,255,255,0.08)":"transparent" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d={PUZZLE_ICON}/></svg>
          </button>
        )}
      </div>

      {/* ── Extension dropdown ────────────────────────────────────────────── */}
      {extDropOpen && (
        <ExtDropdown extensions={extensions} anchorRef={extBtnRef}
          onClose={() => setExtDropOpen(false)} onOpenPopup={handleExtPopup} />
      )}

      {/* ── Extension Manager modal ───────────────────────────────────────── */}
      {extMgrOpen && <ExtensionManager onClose={handleExtMgrClose} />}

      {/* ── Content area (WebContentsView sits here, managed by main) ─────── */}
      <div ref={contentRef} className="browser__view-wrap">
        {!ready && (
          <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",
            justifyContent:"center",flexDirection:"column",gap:8 }}>
            <div style={{ width:20,height:20,border:"2px solid #333",borderTopColor:"#007acc",
              borderRadius:"50%",animation:"browser-spin 0.7s linear infinite" }}/>
            <span style={{ fontSize:12,color:"#555" }}>Initializing…</span>
          </div>
        )}
      </div>

      <style>{`
        .browser__tabs { display:flex;align-items:center;height:34px;background:#1a1a1a;border-bottom:1px solid #2a2a2a;flex-shrink:0;overflow:hidden; }
        .browser__tab-list { display:flex;align-items:center;flex:1;overflow:hidden;height:100%; }
        .browser__tab { display:flex;align-items:center;gap:5px;padding:0 8px 0 10px;height:100%;min-width:80px;max-width:200px;cursor:pointer;flex-shrink:1;overflow:hidden;border-right:1px solid #222;color:#888;font-size:11px;user-select:none;background:transparent;transition:background 0.1s; }
        .browser__tab:hover { background:rgba(255,255,255,0.05); }
        .browser__tab--active { background:#1e1e1e;color:#d0d0d0;border-bottom:2px solid #007acc; }
        .browser__tab-title { flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px; }
        .browser__tab-spinner { width:10px;height:10px;border:1.5px solid #444;border-top-color:#007acc;border-radius:50%;animation:browser-spin 0.7s linear infinite;flex-shrink:0; }
        .browser__tab-close { width:16px;height:16px;border:none;border-radius:3px;background:transparent;color:#666;cursor:pointer;font-size:13px;line-height:14px;flex-shrink:0;padding:0;display:flex;align-items:center;justify-content:center; }
        .browser__new-tab { flex-shrink:0;width:28px;height:100%;border:none;background:transparent;color:#666;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.1s; }
        @keyframes browser-spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default BrowserPanel;
