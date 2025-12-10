import React, { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "webtruyen_state_v3";
const PAGE_CHAR_LEN = 1500;

// Tách nội dung thành trang
function paginateContent(content) {
  if (!content) return [""];
  const pages = [];
  for (let i = 0; i < content.length; i += PAGE_CHAR_LEN) {
    pages.push(content.slice(i, i + PAGE_CHAR_LEN));
  }
  return pages.length ? pages : [""];
}

export default function App() {
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState(null);

  const [fontSize, setFontSize] = useState(19);
  const [fontFamily, setFontFamily] = useState("serif");
  const [darkMode, setDarkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [readMode, setReadMode] = useState("scroll"); // scroll | page
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const [readingPositions, setReadingPositions] = useState({});

  // Editor
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Add chapter
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const contentRef = useRef(null);

  // LOAD STATE
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.chapters)) setChapters(saved.chapters);
      if (saved.selectedChapterId) setSelectedChapterId(saved.selectedChapterId);

      setFontSize(saved.fontSize ?? 19);
      setFontFamily(saved.fontFamily ?? "serif");
      setDarkMode(saved.darkMode ?? false);
      setReadMode(saved.readMode ?? "scroll");
      setReadingPositions(saved.readingPositions ?? {});
    } catch {}
  }, []);

  // SAVE
  useEffect(() => {
    const data = {
      chapters,
      selectedChapterId,
      fontSize,
      fontFamily,
      darkMode,
      readMode,
      readingPositions,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [
    chapters,
    selectedChapterId,
    fontSize,
    fontFamily,
    darkMode,
    readMode,
    readingPositions,
  ]);

  const selectedChapter =
    chapters.find((c) => c.id === selectedChapterId) || null;

  // UPLOAD .TXT
  const uploadChapter = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = () => {
      const newChapter = {
        id: Date.now(),
        title: file.name.replace(/\.txt$/i, ""),
        content: reader.result || "",
      };
      setChapters((prev) => [...prev, newChapter]);
      setSelectedChapterId(newChapter.id);
    };

    reader.readAsText(file);
    e.target.value = "";
  };

  // ADD MANUAL
  const addChapter = (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newChapter = {
      id: Date.now(),
      title: newTitle.trim(),
      content: newContent,
    };

    setChapters([...chapters, newChapter]);
    setSelectedChapterId(newChapter.id);
    setNewTitle("");
    setNewContent("");
  };

  const deleteChapter = (id) => {
    setChapters(chapters.filter((c) => c.id !== id));
    if (selectedChapterId === id) {
      setSelectedChapterId(null);
      setIsEditing(false);
    }
  };

  const startEdit = () => {
    setEditTitle(selectedChapter.title);
    setEditContent(selectedChapter.content);
    setIsEditing(true);
  };

  const saveEdit = () => {
    setChapters((prev) =>
      prev.map((c) =>
        c.id === selectedChapterId
          ? { ...c, title: editTitle.trim(), content: editContent }
          : c
      )
    );
    setIsEditing(false);
  };

  const cancelEdit = () => setIsEditing(false);

  useEffect(() => {
    if (!selectedChapterId) return;
    const pos = readingPositions[selectedChapterId];

    if (readMode === "page") {
      setCurrentPageIndex(pos?.pageIndex ?? 0);
    } else {
      setCurrentPageIndex(0);
    }
  }, [selectedChapterId, readMode]);

  useEffect(() => {
    if (!selectedChapterId) return;
    setReadingPositions((prev) => ({
      ...prev,
      [selectedChapterId]: {
        ...(prev[selectedChapterId] || {}),
        pageIndex: currentPageIndex,
      },
    }));
  }, [currentPageIndex]);

  useEffect(() => {
    if (!contentRef.current) return;
    const pos = readingPositions[selectedChapterId];
    if (readMode === "scroll") {
      contentRef.current.scrollTo({
        top: pos?.scrollTop ?? 0,
        behavior: "smooth",
      });
    } else {
      contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [selectedChapterId, readMode, currentPageIndex]);

  const handleScroll = () => {
    if (readMode !== "scroll") return;
    const top = contentRef.current.scrollTop;
    setReadingPositions((prev) => ({
      ...prev,
      [selectedChapterId]: {
        ...(prev[selectedChapterId] || {}),
        scrollTop: top,
      },
    }));
  };

  const exportTxt = () => {
    if (!selectedChapter) return;
    const blob = new Blob([selectedChapter.content], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `${selectedChapter.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Paging
  let display = "";
  let totalPages = 1;

  if (selectedChapter) {
    if (readMode === "page") {
      const pages = paginateContent(selectedChapter.content);
      totalPages = pages.length;
      display = pages[currentPageIndex] || "";
    } else {
      display = selectedChapter.content;
    }
  }

  return (
    <div
      className={`min-h-screen flex ${
        darkMode ? "bg-slate-900 text-slate-100" : "bg-gray-100 text-gray-800"
      }`}
    >
      {/* SIDEBAR */}
      <div
        className={`w-72 border-r p-4 flex flex-col ${
          darkMode ? "bg-slate-950/60 border-slate-700" : "bg-white"
        }`}
      >
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">📚 Trình đọc truyện</h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="px-3 py-1 text-xs border rounded"
          >
            {darkMode ? "☀️ Sáng" : "🌙 Tối"}
          </button>
        </div>

        <label className="font-semibold text-xs">Upload chương (.txt)</label>
        <input
          type="file"
          accept=".txt"
          onChange={uploadChapter}
          className="mb-3 text-sm"
        />

        <label className="font-semibold text-xs">Tìm kiếm chương</label>
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full mb-3 px-2 py-1 text-sm border rounded"
          placeholder="Nhập tên..."
        />

        <div className="flex-1 overflow-y-auto mb-3">
          {chapters
            .filter((c) =>
              c.title.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedChapterId(c.id);
                  setIsEditing(false);
                }}
                className={`p-2 rounded text-sm mb-1 cursor-pointer ${
                  c.id === selectedChapterId
                    ? darkMode
                      ? "bg-slate-700"
                      : "bg-blue-200"
                    : darkMode
                    ? "hover:bg-slate-800"
                    : "hover:bg-gray-200"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span>{c.title}</span>
                  <button
                    className="text-red-500 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChapter(c.id);
                    }}
                  >
                    Xoá
                  </button>
                </div>
              </div>
            ))}
        </div>

        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            ➕ Thêm chương mới
          </summary>
          <form onSubmit={addChapter} className="mt-2 flex flex-col gap-2">
            <input
              className="px-2 py-1 text-sm border rounded"
              placeholder="Tiêu đề"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <textarea
              className="px-2 py-1 text-sm border rounded"
              rows={4}
              placeholder="Nội dung..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
            />
            <button className="py-1 text-sm bg-blue-600 text-white rounded">
              Lưu
            </button>
          </form>
        </details>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col">
        <div
          className={`p-4 border-b flex justify-between items-center ${
            darkMode ? "border-slate-600" : ""
          }`}
        >
          <h2 className="text-xl font-bold">
            {selectedChapter?.title || "Chưa chọn chương"}
          </h2>

          {selectedChapter && (
            <div className="flex gap-2 text-xs">
              <button
                onClick={startEdit}
                className="px-3 py-1 border rounded hover:bg-blue-600 hover:text-white"
              >
                ✏️ Chỉnh sửa
              </button>
              <button
                onClick={exportTxt}
                className="px-3 py-1 border rounded hover:bg-green-600 hover:text-white"
              >
                📥 Xuất TXT
              </button>
            </div>
          )}
        </div>

        {/* TOOLBAR */}
        {selectedChapter && (
          <div className="p-3 flex gap-4 text-sm items-center">
            {/* read mode */}
            <div>
              <span className="font-semibold mr-1">Chế độ:</span>
              <select
                value={readMode}
                onChange={(e) => setReadMode(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="scroll">Cuộn</option>
                <option value="page">Lật trang</option>
              </select>
            </div>

            {/* font size */}
            <div className="flex items-center gap-1">
              <span className="font-semibold">Cỡ chữ:</span>
              <button
                onClick={() => setFontSize(fontSize - 2)}
                className="border px-2 rounded"
              >
                A-
              </button>
              <span>{fontSize}px</span>
              <button
                onClick={() => setFontSize(fontSize + 2)}
                className="border px-2 rounded"
              >
                A+
              </button>
            </div>

            {/* font family */}
            <div>
              <span className="font-semibold mr-1">Font:</span>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="serif">Mặc định Serif</option>
                <option value="sans-serif">Mặc định Sans-serif</option>
                <option value="monospace">Monospace</option>

                {/* Font mới */}
                <option value="Merriweather">Merriweather</option>
                <option value="Lora">Lora</option>
                <option value="Noto Serif">Noto Serif</option>
                <option value="Roboto Slab">Roboto Slab</option>
                <option value="Open Sans">Open Sans</option>
              </select>
            </div>
          </div>
        )}

        {/* CONTENT */}
        <div className="p-5 flex-1 overflow-y-auto">
          {!selectedChapter && (
            <div className="mt-20 text-center text-gray-500">
              Hãy chọn hoặc thêm chương để đọc.
            </div>
          )}

          {/* EDITOR */}
          {selectedChapter && isEditing && (
            <div className="max-w-4xl mx-auto space-y-3">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <textarea
                rows={18}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <div className="flex gap-3">
                <button
                  onClick={saveEdit}
                  className="px-4 py-2 bg-green-600 text-white rounded"
                >
                  💾 Lưu
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 border rounded"
                >
                  Huỷ
                </button>
              </div>
            </div>
          )}

          {/* READER */}
          {selectedChapter && !isEditing && (
            <div className="max-w-4xl mx-auto space-y-3">
              {readMode === "page" && (
                <div className="flex justify-between text-xs opacity-70">
                  <span>
                    Trang {currentPageIndex + 1}/{totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="px-2 py-1 border rounded"
                      disabled={currentPageIndex === 0}
                      onClick={() =>
                        setCurrentPageIndex((p) => Math.max(0, p - 1))
                      }
                    >
                      ◀ Trước
                    </button>
                    <button
                      className="px-2 py-1 border rounded"
                      disabled={currentPageIndex >= totalPages - 1}
                      onClick={() =>
                        setCurrentPageIndex((p) =>
                          Math.min(totalPages - 1, p + 1)
                        )
                      }
                    >
                      Sau ▶
                    </button>
                  </div>
                </div>
              )}

              <div
                ref={contentRef}
                onScroll={handleScroll}
                style={{
                  fontSize,
                  fontFamily: `"${fontFamily}", serif`,
                }}
                className={`p-6 border rounded shadow max-h-[80vh] overflow-y-auto leading-8 ${
                  darkMode ? "bg-slate-900 border-slate-700" : "bg-white"
                }`}
              >
                {display}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
