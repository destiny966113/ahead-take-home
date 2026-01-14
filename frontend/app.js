// API Helper Functions
function headers() {
  return { 'X-Role': document.getElementById('role').value };
}

async function postForm(url, formData) {
  const res = await fetch(url, { method: 'POST', headers: headers(), body: formData });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function postJSON(url, json) {
  const res = await fetch(url, { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(json) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function getJSON(url) {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteRequest(url) {
  const res = await fetch(url, { method: 'DELETE', headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function log(el, data) {
  if (!el) return;
  el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

// Escape HTML for safe rendering
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Render a neat summary of the GROBID JSON
function renderGrobidPreview(data) {
  const wrap = document.getElementById('grobidPreview');
  const container = document.getElementById('grobidSummary');
  if (!wrap || !container) return;

  if (!data || typeof data !== 'object') {
    wrap.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  // Extract fields with fallbacks
  const omipId = data.omip_id || data.omipId || '';
  const title = data.title || '';
  const year = data.year || data.publication_year || '';
  const authorsRaw = Array.isArray(data.authors) ? data.authors : [];
  const authors = authorsRaw.map(a => {
    if (typeof a === 'string') return a;
    if (a && typeof a === 'object') {
      const parts = [a.given || a.first || '', a.family || a.last || ''].filter(Boolean);
      return parts.join(' ').trim() || (a.name || '');
    }
    return '';
  }).filter(Boolean);

  const tables = Array.isArray(data.tables) ? data.tables : [];
  const figures = Array.isArray(data.figures) ? data.figures : [];

  const chips = [];
  if (omipId) chips.push(`<span class="chip run">${escapeHtml(omipId)}</span>`);
  if (year) chips.push(`<span class="chip">${escapeHtml(year)}</span>`);
  chips.push(`<span class="chip">${authors.length} author${authors.length === 1 ? '' : 's'}</span>`);
  chips.push(`<span class="chip">${tables.length} table${tables.length === 1 ? '' : 's'}</span>`);
  chips.push(`<span class="chip">${figures.length} figure${figures.length === 1 ? '' : 's'}</span>`);

  let html = '';
  if (title) {
    html += `<div style="margin-bottom:8px;">
      <div style="font-weight:700; font-size:16px; line-height:1.3;">${escapeHtml(title)}</div>
    </div>`;
  }
  html += `<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">${chips.join('')}</div>`;

  if (authors.length) {
    html += `<div class="section-title">Authors</div>
    <div style="margin-bottom:8px;">${escapeHtml(authors.join(', '))}</div>`;
  }

  if (tables.length) {
    html += `<div class="section-title">Tables</div>`;
    html += `<div class="table-container"><table class="data-table"><tr><th style="width:70px;">No.</th><th>Caption</th><th style="width:80px;">Rows</th></tr>`;
    for (const t of tables) {
      const num = t.number || t.label || '';
      const cap = t.caption || '';
      const rowsLen = Array.isArray(t.rows) ? t.rows.length : (Array.isArray(t.content?.rows) ? t.content.rows.length : '');
      html += `<tr>
        <td>${escapeHtml(num)}</td>
        <td>${escapeHtml(cap)}</td>
        <td style="text-align:right;">${escapeHtml(rowsLen)}</td>
      </tr>`;
    }
    html += `</table></div>`;

    // Render full tables below the summary
    html += `<div class="section-title" style="margin-top:16px;">Table Details</div>`;
    for (const t of tables) {
      const num = t.number || t.label || '';
      const cap = t.caption || '';
      const rows = Array.isArray(t.rows) ? t.rows : (Array.isArray(t.content?.rows) ? t.content.rows : []);

      html += `<div style="margin:8px 0 16px;">
        <div style="font-weight:600; margin-bottom:6px;">Table ${escapeHtml(num)} — ${escapeHtml(cap)}</div>
        <div class="table-container"><table class="data-table">`;

      if (Array.isArray(rows) && rows.length) {
        rows.forEach((row, rIdx) => {
          html += '<tr>';
          // Normalize row representation
          let cells = [];
          if (Array.isArray(row)) {
            cells = row;
          } else if (row && typeof row === 'object' && Array.isArray(row.cells)) {
            cells = row.cells;
          } else if (typeof row === 'string') {
            cells = [row];
          } else {
            cells = [row];
          }

          cells.forEach(cell => {
            let text = '';
            let colspan = 0;
            let rowspan = 0;
            if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
              text = cell.text ?? cell.value ?? cell.content ?? '';
              colspan = cell.colspan || cell.colSpan || 0;
              rowspan = cell.rowspan || cell.rowSpan || 0;
            } else {
              text = cell ?? '';
            }
            const safe = escapeHtml(String(text ?? '')).replace(/\n/g, '<br>');
            const attrCol = colspan && Number(colspan) > 1 ? ` colspan="${Number(colspan)}"` : '';
            const attrRow = rowspan && Number(rowspan) > 1 ? ` rowspan="${Number(rowspan)}"` : '';
            const tag = rIdx === 0 ? 'th' : 'td';
            html += `<${tag}${attrCol}${attrRow}>${safe}</${tag}>`;
          });
          html += '</tr>';
        });
      } else {
        html += `<tr><td><em>No table rows available</em></td></tr>`;
      }

      html += `</table></div></div>`;
    }
  }

  if (figures.length) {
    html += `<div class="section-title">Figures</div>`;
    html += `<div class="table-container"><table class="data-table"><tr><th style="width:70px;">No.</th><th>Caption</th></tr>`;
    for (const f of figures) {
      const num = f.number || f.label || '';
      const cap = f.caption || '';
      html += `<tr>
        <td>${escapeHtml(num)}</td>
        <td>${escapeHtml(cap)}</td>
      </tr>`;
    }
    html += `</table></div>`;
  }

  container.innerHTML = html;
  wrap.style.display = 'block';
}

// Navigation
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    btn.classList.add('active');

    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tabEl = document.getElementById('tab-' + tab);
    if (tabEl) tabEl.classList.add('active');

    // Update page title
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) {
      titleEl.textContent = tab === 'processor' ? 'File Processor' : 'Post-Processing';
    }

    // Load data when switching tabs
    if (tab === 'processor') {
      loadLibrary();
      const batchId = document.getElementById('batchId');
      if (batchId && batchId.value) pollBatch();
    }
    if (tab === 'post') loadProcessed();
  });
});

// File Upload
const inputFiles = document.getElementById('files');
const dropZone = document.getElementById('dropZone');
const btnSelectFiles = document.getElementById('btnSelectFiles');
const btnUpload = document.getElementById('btnUpload');
const uploadResult = document.getElementById('uploadResult');

// Select Files
if (btnSelectFiles) {
  btnSelectFiles.onclick = () => inputFiles && inputFiles.click();
}

// File input change handler
if (inputFiles) {
  inputFiles.addEventListener('change', () => {
    if (!uploadResult) return;
    const names = Array.from(inputFiles.files || []).map(f => f.name);
    log(uploadResult, names.length ? `Selected ${names.length} file(s):\n${names.join('\n')}` : 'No files selected');
  });
}

// Upload button
if (btnUpload) {
  btnUpload.onclick = async () => {
    const el = document.getElementById('files');
    if (!el) return;
    if (!el.files || el.files.length === 0) {
      el.click();
      return;
    }
    const form = new FormData();
    for (const f of el.files) form.append('files', f);

    try {
      log(uploadResult, 'Uploading...');
      const data = await postForm('/api/uploads', form);
      log(uploadResult, `✓ Uploaded ${data.papers?.length || 0} file(s) successfully`);
      // Reset file input
      el.value = '';
      // Reload library
      await loadLibrary(libraryPage);
    } catch (e) {
      log(uploadResult, `✗ Error: ${e.toString()}`);
    }
  };
}

// Drag & Drop
if (dropZone) {
  dropZone.addEventListener('click', () => inputFiles && inputFiles.click());

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag');
  });

  dropZone.addEventListener('dragleave', e => {
    e.preventDefault();
    dropZone.classList.remove('drag');
  });

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag');
    if (inputFiles && e.dataTransfer.files) {
      inputFiles.files = e.dataTransfer.files;
      // Trigger change event
      const event = new Event('change');
      inputFiles.dispatchEvent(event);
    }
  });
}

// Library Management
let selectedPapers = new Set();
let libraryPage = 1;
const PAGE_SIZE = 10;
let currentLibraryItems = [];
let libraryTotal = 0;

function updateSelectionInfo() {
  const selectionInfo = document.getElementById('selectionInfo');
  const selectionCount = document.getElementById('selectionCount');
  if (!selectionInfo || !selectionCount) return;

  if (selectedPapers.size > 0) {
    selectionCount.textContent = selectedPapers.size;
    selectionInfo.style.display = 'block';
  } else {
    selectionInfo.style.display = 'none';
  }
}

async function loadLibrary(page = libraryPage) {
  try {
    libraryPage = page;
    const offset = (libraryPage - 1) * PAGE_SIZE;
    const [papers, countRes] = await Promise.all([
      getJSON(`/api/papers?limit=${PAGE_SIZE}&offset=${offset}`),
      getJSON(`/api/papers/count`),
    ]);
    libraryTotal = Number(countRes?.count || 0);
    currentLibraryItems = papers;
    const tb = document.getElementById('libraryTable');
    if (!tb) return;

    let html = '<tr><th><input type="checkbox" id="selectAllCheckbox" /></th><th>Paper ID</th><th>Filename</th><th>Official Run</th><th>Created</th></tr>';
    for (const p of papers) {
      const checked = selectedPapers.has(p.id) ? 'checked' : '';
      html += `<tr>
        <td><input type="checkbox" data-id="${p.id}" ${checked} /></td>
        <td><code>${p.id}</code></td>
        <td>${p.filename || '-'}</td>
        <td>${p.official_run_id ? `<code>${p.official_run_id.substring(0, 8)}...</code>` : '-'}</td>
        <td>${p.created_at ? new Date(p.created_at).toLocaleString() : '-'}</td>
      </tr>`;
    }
    tb.innerHTML = html;

    // Add checkbox listeners
    tb.querySelectorAll('input[type=checkbox][data-id]').forEach(box => {
      box.addEventListener('change', e => {
        const id = e.target.dataset.id;
        if (e.target.checked) {
          selectedPapers.add(id);
        } else {
          selectedPapers.delete(id);
        }
        updateSelectionInfo();
        updateSelectAllCheckbox();
      });
    });

    // Select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', e => {
        const checked = e.target.checked;
        if (checked) {
          selectedPapers = new Set(papers.map(p => p.id));
        } else {
          selectedPapers.clear();
        }
        updateSelectionInfo();
        loadLibrary();
      });
    }

    updateSelectAllCheckbox();
    updateSelectionInfo();

    // Update pager
    const info = document.getElementById('libPageInfo');
    const prev = document.getElementById('libPrev');
    const next = document.getElementById('libNext');
    const totalPages = Math.max(1, Math.ceil(libraryTotal / PAGE_SIZE));
    if (info) info.textContent = `Page ${libraryPage}/${totalPages} • Total: ${libraryTotal}`;
    if (prev) prev.disabled = libraryPage <= 1;
    if (next) next.disabled = libraryPage >= totalPages;
  } catch (e) {
    console.error('Failed to load library:', e);
  }
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  if (!selectAllCheckbox) return;

  const checkboxes = document.querySelectorAll('input[type=checkbox][data-id]');
  const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;

  selectAllCheckbox.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
  selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

// Library Actions
const btnLoadLibrary = document.getElementById('btnLoadLibrary');
if (btnLoadLibrary) btnLoadLibrary.onclick = () => loadLibrary(libraryPage);

const btnSelectAll = document.getElementById('btnSelectAll');
if (btnSelectAll) {
  btnSelectAll.onclick = async () => {
    selectedPapers = new Set(currentLibraryItems.map(p => p.id));
    updateSelectionInfo();
    loadLibrary(libraryPage);
  };
}

const btnParseSelected = document.getElementById('btnParseSelected');
if (btnParseSelected) {
  btnParseSelected.onclick = async () => {
    const ids = Array.from(selectedPapers);
    if (!ids.length) {
      alert('Please select papers to parse');
      return;
    }

    try {
      const data = await postJSON('/api/parse', { paper_ids: ids });
      const batchIdEl = document.getElementById('batchId');
      if (batchIdEl) batchIdEl.value = data.batch_id;
      pollBatch();
    } catch (e) {
      alert('Failed to start parsing: ' + e.message);
    }
  };
}

const btnDeleteSelected = document.getElementById('btnDeleteSelected');
if (btnDeleteSelected) {
  btnDeleteSelected.onclick = async () => {
    const ids = Array.from(selectedPapers);
    if (!ids.length) {
      alert('Please select papers to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${ids.length} selected paper(s)?`)) {
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      for (const id of ids) {
        try {
          await deleteRequest(`/api/papers/${id}`);
          selectedPapers.delete(id);
          successCount++;
        } catch (e) {
          console.error(`Failed to delete ${id}:`, e);
          failCount++;
        }
      }

      updateSelectionInfo();
      await loadLibrary(libraryPage);

      const message = failCount > 0
        ? `Deleted ${successCount} paper(s). ${failCount} failed.`
        : `Successfully deleted ${successCount} paper(s)`;
      alert(message);
    } catch (e) {
      alert('Failed to delete papers: ' + e.message);
    }
  };
}

const btnDeleteAll = document.getElementById('btnDeleteAll');
if (btnDeleteAll) {
  btnDeleteAll.onclick = async () => {
    if (!confirm('This will permanently delete ALL papers, runs, and extracted elements.\nAre you sure?')) return;
    try {
      const res = await fetch('/api/papers', { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error(await res.text());
      selectedPapers.clear();
      libraryPage = 1;
      await loadLibrary(1);
      alert('All papers deleted.');
    } catch (e) {
      alert('Failed to delete all papers: ' + e.toString());
    }
  };
}

// Batch Progress
async function pollBatch() {
  const id = document.getElementById('batchId').value;
  const out = document.getElementById('batchProgress');
  const progBar = document.getElementById('progBar');

  if (!id) return;

  try {
    const prog = await getJSON(`/api/batches/${id}`);
    log(out, prog);

    // Update progress bar
    const processed = prog.success_count + prog.failed_count;
    const pct = Math.min(100, Math.floor((processed / Math.max(1, prog.total_count)) * 100));
    if (progBar) progBar.style.width = pct + '%';

    // Continue polling if processing
    if (prog.processing_count > 0) {
      setTimeout(pollBatch, 2000);
    }
  } catch (e) {
    console.error('Polling failed:', e);
  }
}

// Recent Runs (Global History)
async function updateRecentRuns() {
  const runsTable = document.getElementById('runsTable');
  if (!runsTable) return;

  try {
    const runs = await getJSON(`/api/runs?limit=50`);
    
    let html = '<tr><th>Filename</th><th>Run ID</th><th>Task</th><th>Parse</th><th>Error</th><th>Actions</th></tr>';
    for (const r of runs) {
      const task = r.task_state === 'completed' ? '<span class="chip ok">COMPLETED</span>'
        : r.task_state === 'processing' ? '<span class="chip run">PROCESSING</span>'
        : r.task_state === 'failed' ? '<span class="chip err">FAILED</span>'
        : (r.task_state ? `<span class="chip">${String(r.task_state).toUpperCase()}</span>` : '-');

      const parse = r.parse_status === 'draft' ? '<span class="chip run">DRAFT</span>'
        : r.parse_status === 'approved' ? '<span class="chip ok">APPROVED</span>'
        : r.parse_status === 'rejected' ? '<span class="chip err">REJECTED</span>'
        : r.parse_status === 'failed' ? '<span class="chip err">FAILED</span>'
        : (r.parse_status ? `<span class="chip">${String(r.parse_status).toUpperCase()}</span>` : '-');

      const runIdShort = r.run_id ? `<code>${r.run_id.substring(0, 8)}...</code>` : '-';
      
      let action = '';
      if (r.task_state === 'failed' || r.error_msg) {
         // Add Retry button
         action = `<button class="btn btn-sm btn-outline btnRetry" data-run="${r.run_id}">Retry</button>`;
      }

      html += `<tr>
        <td>${r.filename || '-'}</td>
        <td>${runIdShort}</td>
        <td>${task}</td>
        <td>${parse}</td>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(r.error_msg || '')}">${r.error_msg ? escapeHtml(r.error_msg) : '-'}</td>
        <td>${action}</td>
      </tr>`;
    }
    runsTable.innerHTML = html;

    // Attach retry listeners
    runsTable.querySelectorAll('.btnRetry').forEach(btn => {
      btn.onclick = async () => {
        const rid = btn.dataset.run;
        if(!rid) return;
        if(!confirm('Retry this run?')) return;
        try {
          await postJSON(`/api/runs/${rid}/retry`, {});
          alert('Retrying...');
          updateRecentRuns();
        } catch(e) {
          alert('Retry failed: ' + e.message);
        }
      };
    });

  } catch (e) {
    console.error('Failed to update runs:', e);
  }
}

// Poll recent runs periodically
setInterval(updateRecentRuns, 3000);
updateRecentRuns(); // Initial load

const btnPoll = document.getElementById('btnPoll');
if (btnPoll) btnPoll.onclick = () => {
    pollBatch();
    updateRecentRuns();
};

// Post-Processing
let processedPage = 1;
let currentProcessedItems = [];
let processedTotal = 0;

async function loadProcessed(page = processedPage) {
  try {
    processedPage = page;
    const offset = (processedPage - 1) * PAGE_SIZE;
    const [runs, countRes] = await Promise.all([
      getJSON(`/api/runs?task_state=completed&limit=${PAGE_SIZE}&offset=${offset}`),
      getJSON(`/api/runs/count?task_state=completed`),
    ]);
    processedTotal = Number(countRes?.count || 0);
    currentProcessedItems = runs;
    const tp = document.getElementById('processedTable');
    if (!tp) return;

    let html = '<tr><th>Run ID</th><th>Paper ID</th><th>Filename</th><th>Parse Status</th><th>Created</th><th>Actions</th></tr>';
    for (const r of runs) {
      const runIdShort = r.run_id ? `<code>${r.run_id.substring(0, 8)}...</code>` : '-';
      const paperIdShort = r.paper_id ? `<code>${r.paper_id.substring(0, 8)}...</code>` : '-';

      const parseStatus = r.parse_status === 'draft' ? '<span class="chip run">DRAFT</span>'
        : r.parse_status === 'approved' ? '<span class="chip ok">APPROVED</span>'
        : r.parse_status === 'rejected' ? '<span class="chip err">REJECTED</span>'
        : r.parse_status === 'failed' ? '<span class="chip err">FAILED</span>'
        : (r.parse_status ? `<span class=\"chip\">${String(r.parse_status).toUpperCase()}</span>` : '-');

      let actionBtns = `<button class="btn btn-sm btn-outline btnOpen" data-paper="${r.paper_id}" data-run="${r.run_id}">Open</button>`;
      if (r.parse_status === 'approved') {
          const safeFilename = (r.filename || 'data').replace(/[^a-zA-Z0-9._-]/g, '_');
          actionBtns += ` <button class="btn btn-sm btn-outline btnDownload" data-run="${r.run_id}" data-filename="${safeFilename}">Download JSON</button>`;
      }

      html += `<tr>
        <td>${runIdShort}</td>
        <td>${paperIdShort}</td>
        <td>${r.filename || '-'}</td>
        <td>${parseStatus}</td>
        <td>${r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
        <td>${actionBtns}</td>
      </tr>`;
    }
    tp.innerHTML = html;

    // Add open button listeners
    tp.querySelectorAll('.btnOpen').forEach(btn => {
      btn.addEventListener('click', () => {
        const paperDraft = document.getElementById('paperIdDraft');
        const runId = document.getElementById('runId');
        const paperView = document.getElementById('paperIdView');

        if (paperDraft) paperDraft.value = btn.dataset.paper;
        if (runId) runId.value = btn.dataset.run;
        if (paperView) paperView.value = btn.dataset.paper;

        const btnLoadGrobid = document.getElementById('btnLoadGrobid');
        if (btnLoadGrobid) btnLoadGrobid.click();
      });
    });

    // Add download button listeners
    tp.querySelectorAll('.btnDownload').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const runId = btn.dataset.run;
            const filename = btn.dataset.filename;
            if (!runId) return;
            try {
                const data = await getJSON(`/api/runs/${runId}/parser`);
                const jsonStr = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filename}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (err) {
                alert('Download failed: ' + err.message);
            }
        });
    });
  } catch (e) {
    console.error('Failed to load processed items:', e);
  }

  // Update pager
  const info = document.getElementById('procPageInfo');
  const prev = document.getElementById('procPrev');
  const next = document.getElementById('procNext');
  const totalPages = Math.max(1, Math.ceil(processedTotal / PAGE_SIZE));
  if (info) info.textContent = `Page ${processedPage}/${totalPages} • Total: ${processedTotal}`;
  if (prev) prev.disabled = processedPage <= 1;
  if (next) next.disabled = processedPage >= totalPages;
}

const btnLoadProcessed = document.getElementById('btnLoadProcessed');
if (btnLoadProcessed) btnLoadProcessed.onclick = () => loadProcessed(processedPage);

// Export Handlers
const btnExportJson = document.getElementById('btnExportJson');
if (btnExportJson) {
  btnExportJson.onclick = () => {
    window.location.href = '/api/export?format=json';
  };
}

const btnExportParquet = document.getElementById('btnExportParquet');
if (btnExportParquet) {
  btnExportParquet.onclick = () => {
    window.location.href = '/api/export?format=parquet';
  };
}

// Pagination controls
const libPrevBtn = document.getElementById('libPrev');
if (libPrevBtn) libPrevBtn.onclick = () => { if (libraryPage > 1) loadLibrary(libraryPage - 1); };
const libNextBtn = document.getElementById('libNext');
if (libNextBtn) libNextBtn.onclick = () => {
  const totalPages = Math.max(1, Math.ceil(libraryTotal / PAGE_SIZE));
  if (libraryPage < totalPages) loadLibrary(libraryPage + 1);
};

const procPrevBtn = document.getElementById('procPrev');
if (procPrevBtn) procPrevBtn.onclick = () => { if (processedPage > 1) loadProcessed(processedPage - 1); };
const procNextBtn = document.getElementById('procNext');
if (procNextBtn) procNextBtn.onclick = () => {
  const totalPages = Math.max(1, Math.ceil(processedTotal / PAGE_SIZE));
  if (processedPage < totalPages) loadProcessed(processedPage + 1);
};

// Review (Raw GROBID JSON) handler

/* Helper to load content for a specific run version */
async function loadRunContent(runId, versionId) {
  const out = document.getElementById('draftView');
  const editor = document.getElementById('jsonEditor');
  try {
    log(out, 'Loading content...');
    let url = `/api/runs/${runId}/parser`; 
    if (versionId && versionId !== 'latest') {
       url = `/api/runs/${runId}/versions/${versionId}`;
    }

    const data = await getJSON(url);
    log(out, data);
    if (editor) editor.value = JSON.stringify(data, null, 2);
    renderGrobidPreview(data);
    
    // Show/hide helper banner for historical versions
    let banner = document.getElementById('versionBanner');
    if (!banner && versionId && versionId !== 'latest') {
       // Create banner if needed
       // (Optional enhancement, skipping to keep it simple as per request)
    }
  } catch(e) {
    log(out, `Error loading content: ${e.toString()}`);
    renderGrobidPreview(null);
  }
}

const btnLoadGrobid = document.getElementById('btnLoadGrobid');
const versionSelect = document.getElementById('versionSelect');

// Version select handler
if (versionSelect) {
  versionSelect.onchange = async () => {
    const runId = document.getElementById('runId')?.value;
    if (runId) {
      await loadRunContent(runId, versionSelect.value);
    }
  };
}

if (btnLoadGrobid) {
  btnLoadGrobid.onclick = async () => {
    const pidEl = document.getElementById('paperIdDraft');
    const out = document.getElementById('draftView');
    const pid = (pidEl && pidEl.value ? pidEl.value : '').trim();
    const runInput = (document.getElementById('runId')?.value || '').trim();
    
    if (!pid && !runInput) {
      log(out, 'Please enter a paper ID or run ID');
      return;
    }

    try {
      log(out, 'Loading...');
      // Resolve run id priority: prefer explicit run input; otherwise infer latest draft; then official
      let runIdVal = runInput;
      if (!runIdVal) {
        try {
          const draft = await getJSON(`/api/papers/${pid}/draft`);
          runIdVal = draft.run_id || '';
        } catch (e) {
          try {
            const official = await getJSON(`/api/papers/${pid}`);
            runIdVal = official.official_run_id || '';
            log(out, 'No draft found. Paper has an official version. Editing of GROBID JSON is only available for drafts.');
          } catch (_e) {
            throw e;
          }
        }
      }
      const runIdEl = document.getElementById('runId');
      if (runIdEl) runIdEl.value = runIdVal;

      // If only run provided and paper missing, attempt to populate paper input
      if (!pid && runIdVal) {
        try {
          const runInfo = await getJSON(`/api/runs/${runIdVal}`);
          if (runInfo?.run?.paper_id && pidEl) pidEl.value = runInfo.run.paper_id;
        } catch (_) { /* ignore */ }
      }

      if (!runIdVal) {
        log(out, 'No run available for this paper.');
        renderGrobidPreview(null);
        return;
      }

      // Load versions
      if (versionSelect) {
        versionSelect.innerHTML = '';
        versionSelect.style.display = 'none';
        try {
          const versions = await getJSON(`/api/runs/${runIdVal}/versions`);
          if (versions && versions.length > 0) {
             const opt = document.createElement('option');
             opt.value = 'latest';
             opt.textContent = 'Latest (Current)';
             versionSelect.appendChild(opt);

             versions.forEach((v, idx) => {
               // Format date nicely
               const d = new Date(v.created_at).toLocaleString(undefined, {
                 month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
               });
               const title = v.title || v.omip_id || 'Untitled';
               const truncTitle = title.length > 15 ? title.substring(0, 15) + '...' : title;
               
               const o = document.createElement('option');
               o.value = v.id;
               o.textContent = `v${versions.length - idx}: ${truncTitle} (${d})`;
               versionSelect.appendChild(o);
             });
             versionSelect.style.display = 'block';
             versionSelect.value = 'latest';
          }
        } catch(e) {
             console.error('Failed to load versions', e);
        }
      }

      // Load content
      await loadRunContent(runIdVal, 'latest');

    } catch (e) {
      log(out, `✗ Error: ${e.toString()}`);
      renderGrobidPreview(null);
    }
  };
}

// Toggle edit
// Toggle edit
const btnEditJson = document.getElementById('btnEditJson');
const btnCancelJson = document.getElementById('btnCancelJson');
const btnSaveJson = document.getElementById('btnSaveJson');

function toggleEditMode(isEdit) {
  const editor = document.getElementById('jsonEditor');
  const view = document.getElementById('draftView'); // Raw JSON view
  const preview = document.getElementById('grobidPreview'); // Rendered HTML
  
  if (isEdit) {
    // Switch to Edit Mode
    if(editor) editor.style.display = 'block';
    if(view) view.style.display = 'none';
    if(preview) preview.style.display = 'none'; // User requirement: no preview in edit mode
    
    // Update Buttons
    if(btnEditJson) btnEditJson.style.display = 'none';
    if(btnCancelJson) btnCancelJson.style.display = 'block';
    if(btnSaveJson) btnSaveJson.style.display = 'block';
    
  } else {
    // Switch to Preview Mode
    if(editor) editor.style.display = 'none';
    if(view) view.style.display = 'block';
    if(preview) preview.style.display = 'block';

    // Update Buttons
    if(btnEditJson) btnEditJson.style.display = 'block';
    if(btnCancelJson) btnCancelJson.style.display = 'none';
    if(btnSaveJson) btnSaveJson.style.display = 'none';
  }
}

if (btnEditJson) {
  btnEditJson.onclick = () => {
    toggleEditMode(true);
  };
}

if (btnCancelJson) {
  btnCancelJson.onclick = () => {
    // Just revert UI, discard changes (since text stays in textarea until reload, simple hide is enough)
    toggleEditMode(false);
  };
}

// Save JSON
if (btnSaveJson) {
  btnSaveJson.onclick = async () => {
    const run = (document.getElementById('runId')?.value || '').trim();
    const editor = document.getElementById('jsonEditor');
    const out = document.getElementById('draftView');
    if (!run) {
      log(out, 'Missing run ID. Load first.');
      return;
    }
    try {
      const payload = JSON.parse(editor?.value || '{}');
      const res = await fetch(`/api/runs/${run}/parser`, {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Saved successfully!');
      // Reload content
      await loadRunContent(run, 'latest');
      // Revert to preview mode
      toggleEditMode(false);
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
  };
}

// Diff button handler


const btnPatch = document.getElementById('btnPatch');
if (btnPatch) {
  btnPatch.onclick = async () => {
    const id = document.getElementById('elId').value.trim();
    const row = parseInt(document.getElementById('rowIdx').value, 10);
    const col = parseInt(document.getElementById('colIdx').value, 10);
    const val = document.getElementById('newVal').value;
    const out = document.getElementById('draftView');

    if (!id) {
      log(out, 'Please enter an element ID');
      return;
    }

    try {
      log(out, 'Updating...');
      const data = await postJSON(`/api/tables/${id}`, {
        row_index: row,
        col_index: col,
        new_value: val
      });
      log(out, data);
    } catch (e) {
      log(out, `✗ Error: ${e.toString()}`);
    }
  };
}

const btnApprove = document.getElementById('btnApprove');
if (btnApprove) {
  btnApprove.onclick = async () => {
    const run = document.getElementById('runId').value.trim();
    const out = document.getElementById('draftView');
    const role = document.getElementById('role')?.value;

    if (!run) {
      log(out, 'Please enter a run ID');
      return;
    }
    if (role !== 'reviewer') {
      alert('需要 Reviewer 角色才能核准 (Approve)。請先在右上角切換 Role 為 Reviewer。');
      return;
    }

    try {
      log(out, 'Approving...');
      const data = await postJSON(`/api/reviews/${run}/approve`, {});
      log(out, { message: 'Approved successfully', ...data });
      // refresh processed list to reflect status change
      try { await loadProcessed(); } catch (_) {}
      // show latest run info
      try { const r = await getJSON(`/api/runs/${run}`); log(out, r); } catch (_) {}
    } catch (e) {
      log(out, `✗ Error: ${e.toString()}`);
    }
  };
}

const btnReject = document.getElementById('btnReject');
if (btnReject) {
  btnReject.onclick = async () => {
    const run = document.getElementById('runId').value.trim();
    const out = document.getElementById('draftView');
    const role = document.getElementById('role')?.value;

    if (!run) {
      log(out, 'Please enter a run ID');
      return;
    }
    if (role !== 'reviewer') {
      alert('需要 Reviewer 角色才能退回 (Reject)。請先在右上角切換 Role 為 Reviewer。');
      return;
    }

    try {
      log(out, 'Rejecting...');
      const data = await postJSON(`/api/reviews/${run}/reject`, {});
      log(out, { message: 'Rejected successfully', ...data });
      // refresh processed list to reflect status change
      try { await loadProcessed(); } catch (_) {}
      // show latest run info
      try { const r = await getJSON(`/api/runs/${run}`); log(out, r); } catch (_) {}
    } catch (e) {
      log(out, `✗ Error: ${e.toString()}`);
    }
  };
}

const btnViewerGet = document.getElementById('btnViewerGet');
if (btnViewerGet) {
  btnViewerGet.onclick = async () => {
    const pid = document.getElementById('paperIdView').value.trim();
    const out = document.getElementById('viewerView');

    if (!pid) {
      log(out, 'Please enter a paper ID');
      return;
    }

    try {
      log(out, 'Loading...');
      const data = await getJSON(`/api/papers/${pid}`);
      log(out, data);
    } catch (e) {
      log(out, `✗ Error: ${e.toString()}`);
    }
  };
}

// Initial load
loadLibrary();
