import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

/** =========================
 *  CONSTANTS & HELPERS
 *  ========================= */
const STORAGE_KEY = "webtruyen_state_latest_v2";
const PAGE_CHAR_LEN = 1500;
const COVER_URL = "/cultivation-online-cover.jpg";

/* Helper: Escape HTML để dùng với dangerouslySetInnerHTML */
function escapeHtml(str) {
  if (!str && str !== 0) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Tách nội dung thành trang (chế độ lật trang) */
function paginateContent(content) {
  if (!content) return [""];
  const pages = [];
  for (let i = 0; i < content.length; i += PAGE_CHAR_LEN) {
    pages.push(content.slice(i, i + PAGE_CHAR_LEN));
  }
  return pages.length ? pages : [""];
}

/* Xử lý thoại + block thuộc tính */
function formatParagraphs(text) {
  if (!text) return "";

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");

  const htmlParts = [];

  const processDialogueLine = (line) => {
    const segs = [];

    // 1) "Thoại" + lời dẫn
    let splitDialogue = line.match(/^(“.+?”)(.+)$/);
    if (splitDialogue) {
      let d1 = splitDialogue[1].trim();
      let d2 = splitDialogue[2].trim();
      if (!d1.endsWith("”")) d1 += "”";
      segs.push(d1);
      if (d2) segs.push(d2);
      return segs;
    }

    // 2) Thoại chưa đóng ngoặc
    if (/^“.+/.test(line) && !line.endsWith("”")) {
      let cleaned = line;
      if (!cleaned.endsWith("”")) cleaned += "”";
      segs.push(cleaned);
      return segs;
    }

    // 3) Thoại hoàn chỉnh
    if (/^“.*”$/.test(line)) {
      segs.push(line);
      return segs;
    }

    // 4) Nhiều thoại trong một dòng
    const multi = line
      .split(/(?=“)/g)
      .map((s) => s.trim())
      .filter(Boolean);
    if (multi.length > 1) {
      for (let seg of multi) {
        if (seg.startsWith("“")) {
          if (!seg.endsWith("”")) seg += "”";
          segs.push(seg);
        } else segs.push(seg);
      }
      return segs;
    }

    // 5) Dòng mô tả bình thường
    segs.push(line);
    return segs;
  };

  const renderAttributeRow = (item) =>
    `<div class="flex gap-2 leading-relaxed">
       <span class="font-semibold">${escapeHtml(item.key)}:</span>
       <span>${escapeHtml(item.value)}</span>
     </div>`;

  let i = 0;
  while (i < lines.length) {
    const attrs = [];
    let j = i;
    while (j < lines.length) {
      const m = lines[j].match(/^([^:]{1,40}):\s*(.+)$/);
      if (!m) break;
      attrs.push({ key: m[1].trim(), value: m[2].trim() });
      j++;
    }

    if (attrs.length >= 4) {
      const total = attrs.length;
      const wrapBox = (inner) =>
        `<div class="my-6 inline-block p-4 border border-slate-300 bg-white/80 rounded-lg shadow-sm text-[15px] leading-relaxed">
           ${inner}
         </div>`;

      if (total >= 6) {
        const mid = Math.ceil(total / 2);
        const left = attrs.slice(0, mid);
        const right = attrs.slice(mid);

        const col1 = left.map(renderAttributeRow).join("");
        const col2 = right.length
          ? `<div class="space-y-2">${right
              .map(renderAttributeRow)
              .join("")}</div>`
          : "";

        const inner = `<div class="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                         <div class="space-y-2">${col1}</div>${col2}
                       </div>`;

        htmlParts.push(wrapBox(inner));
      } else {
        const rows = attrs.map(renderAttributeRow).join("");
        const inner = `<div class="space-y-2">${rows}</div>`;
        htmlParts.push(wrapBox(inner));
      }

      i = j;
      continue;
    }

    const segments = processDialogueLine(lines[i]);
    for (let seg of segments) {
      htmlParts.push(`<p class="mb-3">${escapeHtml(seg)}</p>`);
    }
    i++;
  }

  return htmlParts.join("");
}

/* Chuẩn hoá 1 chương */
function normalizeChapter(chapter) {
  let title = (chapter.title || "").trim();
  let content = chapter.content || "";

  content = content
    .replace(/\uFEFF/g, "")
    .replace(/[\u200B-\u200D\u2060]/g, "");

  if (!title || title === "Chương không tên") {
    const lines = content.split(/\r?\n/);
    let idx = lines.findIndex((l) => l.trim() !== "");
    if (idx !== -1) {
      const firstLine = lines[idx].trim();
      if (/^Chương/i.test(firstLine)) {
        title = firstLine;
        lines.splice(idx, 1);
        content = lines.join("\n").trim();
      }
    }
  }

  return { ...chapter, title, content };
}

/** =========================
 *  CUSTOM HOOK: useReaderState
 *  ========================= */
function useReaderState() {
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [fontSize, setFontSize] = useState(19);
  const [fontFamily, setFontFamily] = useState("serif");
  const [lineHeight, setLineHeight] = useState(1.9);
  const [letterSpacing, setLetterSpacing] = useState(0.3);
  const [darkMode, setDarkMode] = useState(false);
  const [readMode, setReadMode] = useState("scroll");
  const [readingPositions, setReadingPositions] = useState({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);

      const loadedChaps = (saved.chapters ?? []).map(normalizeChapter);
      setChapters(loadedChaps);
      setSelectedChapterId(saved.selectedChapterId ?? null);
      setFontSize(saved.fontSize ?? 19);
      setFontFamily(saved.fontFamily ?? "serif");
      setLineHeight(saved.lineHeight ?? 1.9);
      setLetterSpacing(saved.letterSpacing ?? 0.3);
      setDarkMode(saved.darkMode ?? false);
      setReadMode(saved.readMode ?? "scroll");
      setReadingPositions(saved.readingPositions ?? {});
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        chapters,
        selectedChapterId,
        fontSize,
        fontFamily,
        lineHeight,
        letterSpacing,
        darkMode,
        readMode,
        readingPositions,
      })
    );
  }, [
    chapters,
    selectedChapterId,
    fontSize,
    fontFamily,
    lineHeight,
    letterSpacing,
    darkMode,
    readMode,
    readingPositions,
  ]);

  return {
    chapters,
    setChapters,
    selectedChapterId,
    setSelectedChapterId,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    lineHeight,
    setLineHeight,
    letterSpacing,
    setLetterSpacing,
    darkMode,
    setDarkMode,
    readMode,
    setReadMode,
    readingPositions,
    setReadingPositions,
  };
}

/** =========================
 *  COMPONENT: Header + Settings
 *  ========================= */
function SettingsMenu({
  readMode,
  setReadMode,
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
  lineHeight,
  setLineHeight,
  letterSpacing,
  setLetterSpacing,
  darkMode,
  setDarkMode,
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-80 p-4 rounded-xl shadow-xl bg-white border border-slate-200 z-20 text-sm">
      <div className="space-y-4">
        <div>
          <div className="font-semibold mb-1">Chế độ đọc</div>
          <select
            value={readMode}
            onChange={(e) => setReadMode(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            <option value="scroll">Cuộn</option>
            <option value="page">Lật trang</option>
          </select>
        </div>

        <div>
          <div className="font-semibold mb-1">Cỡ chữ</div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setFontSize((v) => Math.max(12, v - 2))}
              className="border px-2 py-1 rounded"
            >
              A-
            </button>
            <span>{fontSize}px</span>
            <button
              onClick={() => setFontSize((v) => v + 2)}
              className="border px-2 py-1 rounded"
            >
              A+
            </button>
          </div>
        </div>

        <div>
          <div className="font-semibold mb-1">Font chữ</div>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            <option value="serif">Serif (mặc định)</option>
            <option value="sans-serif">Sans-serif</option>
            <option value="monospace">Monospace</option>

            {/* Font chữ thẳng, dễ đọc */}
            <option value="Inter">Inter</option>
            <option value="Roboto">Roboto</option>
            <option value="Open Sans">Open Sans</option>
            <option value="Source Sans Pro">Source Sans Pro</option>
            <option value="Nunito">Nunito</option>
            <option value="Montserrat">Montserrat</option>
            <option value="Lexend">Lexend</option>

            {/* Các font cũ */}
            <option value="Lora">Lora</option>
            <option value="Merriweather">Merriweather</option>
            <option value="Arial">Arial</option>
          </select>
        </div>

        {/* Dãn dòng */}
        <div>
          <div className="font-semibold mb-1">Dãn dòng</div>
          <input
            type="range"
            min="1.2"
            max="2.4"
            step="0.1"
            value={lineHeight}
            onChange={(e) => setLineHeight(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="text-xs opacity-70 mt-1">{lineHeight.toFixed(1)}</div>
        </div>

        {/* Dãn chữ */}
        <div>
          <div className="font-semibold mb-1">Dãn chữ</div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={letterSpacing}
            onChange={(e) => setLetterSpacing(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="text-xs opacity-70 mt-1">
            {letterSpacing.toFixed(1)}px
          </div>
        </div>

        <div>
          <div className="font-semibold mb-1">Giao diện</div>
          <button
            onClick={() => setDarkMode((v) => !v)}
            className={`px-3 py-1 rounded border w-full text-center ${
              darkMode
                ? "bg-slate-800 text-white border-slate-600"
                : "bg-slate-100 border-slate-300"
            }`}
          >
            {darkMode ? "🌙 Dark Mode" : "☀️ Light Mode"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({
  novelTitle,
  chapterTitle,
  darkMode,
  setDarkMode,
  readMode,
  setReadMode,
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
  lineHeight,
  setLineHeight,
  letterSpacing,
  setLetterSpacing,
  onUploadClick,
  onTocClick,
  onHomeClick,
  pageInfo,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const popupRef = useRef(null);
  const hideHeader = useHideOnScroll();
  const btnSettingId = "btn-setting-reader";

  useEffect(() => {
    const handler = (e) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target) &&
        !e.target.closest(`#${btnSettingId}`)
      ) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener("mousedown", handler);
    }

    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, [showSettings]);

  return (
    <header
      className={`border-b sticky top-0 z-10 transition-transform duration-300 ${
        hideHeader ? "-translate-y-full" : "translate-y-0"
      } ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white"}`}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* LEFT – HOME ICON */}
        <div className="flex items-center gap-2">
          <button
            onClick={onHomeClick}
            className="text-2xl hover:opacity-80 transition"
            title="Trang chủ"
          >
            🗡️
          </button>
        </div>

        {/* CENTER – TITLE */}
        <div className="text-center flex-1">
          <h1 className="text-xl md:text-2xl font-bold">
            {novelTitle || "Tu Chân Chi Giới Online"}
          </h1>
          <div className="text-xs md:text-sm opacity-80">
            {chapterTitle || "Chưa chọn chương"}
          </div>

          {pageInfo && readMode === "page" && (
            <div className="text-[11px] md:text-xs opacity-70 mt-1">
              Trang {pageInfo.current}/{pageInfo.total}
            </div>
          )}
        </div>

        {/* RIGHT – ACTION BUTTONS */}
        <div className="flex items-center gap-3">
          <button
            onClick={onTocClick}
            className="w-9 h-9 rounded-full border bg-white text-slate-700 flex items-center justify-center shadow-sm text-lg"
            title="Mục lục"
          >
            📑
          </button>

          <button
            onClick={onUploadClick}
            className="w-9 h-9 rounded-full border bg-white text-slate-700 flex items-center justify-center shadow-sm text-lg"
            title="Upload chương (.txt)"
          >
            📤
          </button>

          <div className="relative" ref={popupRef}>
            <button
              id={btnSettingId}
              onClick={() => setShowSettings((v) => !v)}
              className="px-3 py-1.5 text-xs md:text-sm rounded-full border shadow-sm bg-white text-slate-800 flex items-center gap-1"
            >
              ⚙ <span className="hidden sm:inline">Cài đặt</span>
            </button>

            {showSettings && (
              <SettingsMenu
                readMode={readMode}
                setReadMode={setReadMode}
                fontSize={fontSize}
                setFontSize={setFontSize}
                fontFamily={fontFamily}
                setFontFamily={setFontFamily}
                lineHeight={lineHeight}
                setLineHeight={setLineHeight}
                letterSpacing={letterSpacing}
                setLetterSpacing={setLetterSpacing}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/** =========================
 *  HOOK: Auto hide header
 *  ========================= */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      if (current > lastScrollY.current + 10) {
        setHidden(true);
      } else if (current < lastScrollY.current - 10) {
        setHidden(false);
      }
      lastScrollY.current = current;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return hidden;
}

/** =========================
 *  COMPONENT: Home
 *  ========================= */
function Home({ darkMode, onStart }) {
  return (
    <div
      className={`min-h-screen ${
        darkMode ? "bg-slate-950" : "bg-slate-900"
      } text-slate-100`}
    >
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row gap-10 items-start">
        <div className="w-full md:w-1/3 flex justify-center">
          <img
            src={COVER_URL}
            alt="Cultivation Online"
            className="w-64 md:w-80 lg:w-96 rounded-xl shadow-2xl object-cover border border-slate-700"
          />
        </div>

        <div className="w-full md:w-2/3 space-y-6 pt-2">
          <h1 className="text-4xl font-bold tracking-wide leading-tight">
            Cultivation Online
          </h1>

          <div className="text-lg text-slate-300">
            <span className="font-semibold">Tác giả:</span> MyLittleBrother
          </div>

          <div>
            <button
              onClick={onStart}
              className="px-7 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
            >
              BẮT ĐẦU ĐỌC
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {["Cultivation", "Game", "VR", "Action", "System"].map((t) => (
              <span
                key={t}
                className="px-3 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-600"
              >
                {t}
              </span>
            ))}
          </div>

          <div className="text-sm text-slate-200 leading-relaxed max-w-2xl">
            Một kẻ thất bại ở đời thực bước vào thế giới game thực tế ảo{" "}
            <span className="font-semibold">Cultivation Online</span>, nơi tu
            chân, pháp bảo và bí cảnh đều có thể trở thành hiện thực. Từ một
            tên phế vật bị mọi người khinh thường, hắn dần bước lên con đường
            nghịch thiên cải mệnh, cày level, đoạt tạo hoá, đạp lên đỉnh phong
            tu tiên.
          </div>
        </div>
      </div>
    </div>
  );
}

/** =========================
 *  COMPONENT: TOC Popup (BẢN 2: có xoá chương)
 *  ========================= */
function TocPopup({
  chapters,
  selectedChapterId,
  onSelect,
  onDeleteChapter,
  onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex justify-center items-start">
      <div className="mt-24 w-96 bg-white border border-slate-300 rounded-xl shadow-lg p-4 max-h-[70vh] overflow-y-auto">
        <div className="flex justify-between mb-3">
          <h2 className="font-bold text-lg">Mục lục</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded border bg-slate-100 hover:bg-slate-200"
          >
            ✖
          </button>
        </div>

        {chapters.map((c, index) => (
          <div
            key={c.id}
            className={`px-3 py-2 border rounded-lg flex justify-between items-center mb-2 ${
              c.id === selectedChapterId
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white hover:bg-slate-100"
            }`}
          >
            <div
              className="flex-1 cursor-pointer"
              onClick={() => onSelect(c.id)}
            >
              {index + 1}. {c.title || "Chương không tên"}
            </div>

            <button
              onClick={() => onDeleteChapter(c.id)}
              className="ml-2 text-red-600 hover:text-red-800 font-bold text-lg"
              title="Xoá chương"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** =========================
 *  COMPONENT: Reader
 *  ========================= */
function Reader({
  chapters,
  selectedChapterId,
  setSelectedChapterId,
  readMode,
  fontSize,
  fontFamily,
  lineHeight,
  letterSpacing,
  readingPositions,
  setReadingPositions,
  darkMode,
}) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId) || null,
    [chapters, selectedChapterId]
  );

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.id - b.id),
    [chapters]
  );

  const currentIndex = useMemo(
    () => sortedChapters.findIndex((c) => c.id === selectedChapterId),
    [sortedChapters, selectedChapterId]
  );

  const hasPrevChapter = currentIndex > 0;
  const hasNextChapter =
    currentIndex >= 0 && currentIndex < sortedChapters.length - 1;

  const [totalPages, rawDisplay] = useMemo(() => {
    if (!selectedChapter) return [1, ""];
    if (readMode === "page") {
      const pages = paginateContent(selectedChapter.content);
      return [pages.length, pages[currentPageIndex] || ""];
    }
    return [1, selectedChapter.content];
  }, [selectedChapter, readMode, currentPageIndex]);

  const display = useMemo(() => formatParagraphs(rawDisplay), [rawDisplay]);

  // Khôi phục vị trí cuộn khi đổi chương / đổi mode (scroll)
  useEffect(() => {
    if (!selectedChapterId || readMode !== "scroll") return;
    const pos = readingPositions[selectedChapterId];
    if (typeof window !== "undefined") {
      window.scrollTo(0, pos?.scrollTop ?? 0);
    }
  }, [selectedChapterId, readMode]); // cố ý không thêm readingPositions để tránh giật

  // Lưu vị trí cuộn trong chế độ cuộn
  useEffect(() => {
    if (!selectedChapterId || readMode !== "scroll") return;
    const onScroll = () => {
      setReadingPositions((prev) => ({
        ...prev,
        [selectedChapterId]: {
          ...(prev[selectedChapterId] || {}),
          scrollTop: window.scrollY,
        },
      }));
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [selectedChapterId, readMode, setReadingPositions]);

  // Khôi phục / reset pageIndex khi đổi chương hoặc đổi mode
  useEffect(() => {
    if (!selectedChapterId) return;
    const pos = readingPositions[selectedChapterId];
    if (readMode === "page") {
      setCurrentPageIndex(pos?.pageIndex ?? 0);
      if (typeof window !== "undefined") {
        window.scrollTo(0, 0);
      }
    } else {
      setCurrentPageIndex(0);
    }
  }, [selectedChapterId, readMode, readingPositions]);

  // Lưu pageIndex khi đổi trang (chế độ page)
  useEffect(() => {
    if (!selectedChapterId || readMode !== "page") return;
    setReadingPositions((prev) => ({
      ...prev,
      [selectedChapterId]: {
        ...(prev[selectedChapterId] || {}),
        pageIndex: currentPageIndex,
      },
    }));
  }, [currentPageIndex, selectedChapterId, readMode, setReadingPositions]);

  const goPrevChapter = useCallback(() => {
    if (!hasPrevChapter) return;
    setSelectedChapterId(sortedChapters[currentIndex - 1].id);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [hasPrevChapter, sortedChapters, currentIndex, setSelectedChapterId]);

  const goNextChapter = useCallback(() => {
    if (!hasNextChapter) return;
    setSelectedChapterId(sortedChapters[currentIndex + 1].id);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [hasNextChapter, sortedChapters, currentIndex, setSelectedChapterId]);

  // Phím tắt chuyển chương
  useEffect(() => {
    const handler = (e) => {
      if (!selectedChapterId || chapters.length === 0) return;
      if (e.key === "ArrowLeft" && hasPrevChapter) {
        goPrevChapter();
      } else if (e.key === "ArrowRight" && hasNextChapter) {
        goNextChapter();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    chapters.length,
    selectedChapterId,
    hasPrevChapter,
    hasNextChapter,
    goPrevChapter,
    goNextChapter,
  ]);

  if (!selectedChapter) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center opacity-60 text-sm">
        Hãy upload file .txt hoặc chọn chương để bắt đầu đọc.
      </div>
    );
  }

  const resolvedFontFamily =
    fontFamily === "serif" ||
    fontFamily === "sans-serif" ||
    fontFamily === "monospace"
      ? fontFamily
      : `"${fontFamily}", sans-serif`;

  const articleStyle = {
    fontSize,
    fontFamily: resolvedFontFamily,
    lineHeight,
    letterSpacing: `${letterSpacing}px`,
    wordSpacing: "1px",
  };

  return (
    <section className="flex-1">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {readMode === "page" ? (
          <>
            <article
              style={articleStyle}
              className="leading-relaxed"
              dangerouslySetInnerHTML={{ __html: display }}
            />

            <div className="flex justify-between mt-6 text-sm">
              <button
                onClick={() =>
                  setCurrentPageIndex((p) => Math.max(0, p - 1))
                }
                disabled={currentPageIndex === 0}
                className="px-4 py-2 border rounded disabled:opacity-50"
              >
                ◀ Trang trước
              </button>

              <button
                onClick={() =>
                  setCurrentPageIndex((p) =>
                    Math.min(totalPages - 1, p + 1)
                  )
                }
                disabled={currentPageIndex >= totalPages - 1}
                className="px-4 py-2 border rounded disabled:opacity-50"
              >
                Trang sau ▶
              </button>
            </div>
          </>
        ) : (
          <article
            style={articleStyle}
            className="leading-relaxed"
            dangerouslySetInnerHTML={{ __html: display }}
          />
        )}

        <div className="mt-10 mb-20 flex justify-center gap-4 text-sm">
          <button
            onClick={goPrevChapter}
            disabled={!hasPrevChapter}
            className={`px-5 py-2 rounded-lg border flex items-center gap-2 ${
              hasPrevChapter
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            ❮ Chương trước
          </button>

          <button
            onClick={goNextChapter}
            disabled={!hasNextChapter}
            className={`px-5 py-2 rounded-lg border flex items-center gap-2 ${
              hasNextChapter
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            Chương tiếp ❯
          </button>
        </div>
      </div>
    </section>
  );
}

/** =========================
 *  MAIN APP (BẢN 2: có xoá chương)
 *  ========================= */
export default function App() {
  const {
    chapters,
    setChapters,
    selectedChapterId,
    setSelectedChapterId,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    lineHeight,
    setLineHeight,
    letterSpacing,
    setLetterSpacing,
    darkMode,
    setDarkMode,
    readMode,
    setReadMode,
    readingPositions,
    setReadingPositions,
  } = useReaderState();

  const [showHome, setShowHome] = useState(true);
  const [showToc, setShowToc] = useState(false);

  const fileInputRef = useRef(null);

  const handleUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newChaps = [];
    let processed = 0;

    files.forEach((file, fileIndex) => {
      const reader = new FileReader();
      reader.onload = () => {
        let raw = reader.result || "";
        raw = raw
          .replace(/\uFEFF/g, "")
          .replace(/[\u200B-\u200D\u2060]/g, "")
          .replace(/\u2028|\u2029/g, "\n")
          .replace(/\r\n|\r/g, "\n");

        let lines = raw.split("\n").map((l) => l.trim());
        while (lines.length && lines[0] === "") lines.shift();

        const novel = lines[0] || file.name.replace(/\.txt$/i, "");

        let rawLine2 = lines[1] ?? "";
        let title = "";
        let contentStart = 2;

        const idxSmart = rawLine2.indexOf("“");
        const idxQuote = rawLine2.indexOf('"');
        let idx = -1;
        if (idxSmart >= 0 && idxQuote >= 0) idx = Math.min(idxSmart, idxQuote);
        else if (idxSmart >= 0) idx = idxSmart;
        else if (idxQuote >= 0) idx = idxQuote;

        if (idx > 0) {
          title = rawLine2.slice(0, idx).trim();
          lines[1] = rawLine2.slice(idx).trim();
          contentStart = 1;
        } else {
          title = rawLine2 || "Chương không tên";
          contentStart = 2;
        }

        let content = lines.slice(contentStart).join("\n").trim();

        const newChap = normalizeChapter({
          id: Date.now() + Math.random() + fileIndex / 1000, // vẫn uniq, giữ tương thích
          novel,
          title,
          content,
        });

        newChaps.push(newChap);
        processed++;

        if (processed === files.length) {
          setChapters((prev) => [...prev, ...newChaps]);
          setSelectedChapterId((prevId) => prevId ?? newChaps[0]?.id ?? null);

          newChaps.forEach((chap) => {
            setReadingPositions((prev) => ({
              ...prev,
              [chap.id]: { scrollTop: 0, pageIndex: 0 },
            }));
          });

          setShowHome(false);
          if (typeof window !== "undefined") {
            window.scrollTo(0, 0);
          }
          e.target.value = "";
        }
      };
      reader.readAsText(file);
    });
  };

  const handleDeleteChapter = (id) => {
    setChapters((prev) => {
      const sortedPrev = [...prev].sort((a, b) => a.id - b.id);
      const idx = sortedPrev.findIndex((c) => c.id === id);
      const filtered = prev.filter((c) => c.id !== id);

      // Xoá vị trí đọc
      setReadingPositions((prevPos) => {
        const clone = { ...prevPos };
        delete clone[id];
        return clone;
      });

      // Nếu đang xoá chương hiện tại
      if (selectedChapterId === id) {
        if (sortedPrev.length > 1) {
          const newIdx = idx === sortedPrev.length - 1 ? idx - 1 : idx + 1;
          const newChap = sortedPrev[newIdx];
          setSelectedChapterId(newChap ? newChap.id : null);
          if (!newChap) {
            setShowHome(true);
          }
        } else {
          setSelectedChapterId(null);
          setShowHome(true);
        }
      }

      return filtered;
    });
  };

  const selectedChapter =
    chapters.find((c) => c.id === selectedChapterId) || null;

  const mainBg = darkMode
    ? "bg-slate-900 text-slate-100"
    : "bg-slate-100 text-slate-900";

  return (
    <div className={`min-h-screen ${mainBg}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        onChange={handleUpload}
        className="hidden"
        multiple
      />

      {showHome ? (
        <Home
          darkMode={darkMode}
          onStart={() => {
            setShowHome(false);
            if (!selectedChapter && chapters.length > 0) {
              setSelectedChapterId(chapters[0].id);
            }
            if (typeof window !== "undefined") {
              window.scrollTo(0, 0);
            }
          }}
        />
      ) : (
        <>
          <Header
            novelTitle={selectedChapter?.novel}
            chapterTitle={selectedChapter?.title}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            readMode={readMode}
            setReadMode={setReadMode}
            fontSize={fontSize}
            setFontSize={setFontSize}
            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
            lineHeight={lineHeight}
            setLineHeight={setLineHeight}
            letterSpacing={letterSpacing}
            setLetterSpacing={setLetterSpacing}
            onUploadClick={() => fileInputRef.current?.click()}
            onTocClick={() => setShowToc(true)}
            onHomeClick={() => {
              setShowHome(true);
              if (typeof window !== "undefined") {
                window.scrollTo(0, 0);
              }
            }}
            pageInfo={
              readMode === "page" && selectedChapter
                ? {
                    current:
                      (readingPositions[selectedChapterId]?.pageIndex ?? 0) +
                      1,
                    total: paginateContent(selectedChapter.content).length,
                  }
                : null
            }
          />

          <Reader
            chapters={chapters}
            selectedChapterId={selectedChapterId}
            setSelectedChapterId={setSelectedChapterId}
            readMode={readMode}
            fontSize={fontSize}
            fontFamily={fontFamily}
            lineHeight={lineHeight}
            letterSpacing={letterSpacing}
            readingPositions={readingPositions}
            setReadingPositions={setReadingPositions}
            darkMode={darkMode}
          />

          {showToc && (
            <TocPopup
              chapters={[...chapters].sort((a, b) => a.id - b.id)}
              selectedChapterId={selectedChapterId}
              onSelect={(id) => {
                setSelectedChapterId(id);
                setShowToc(false);
                if (typeof window !== "undefined") {
                  window.scrollTo(0, 0);
                }
              }}
              onDeleteChapter={handleDeleteChapter}
              onClose={() => setShowToc(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
