(() => {
  const progressBar = document.getElementById('readProgressBar');
  const navLinks = Array.from(document.querySelectorAll('.masthead__nav .nav-link'));
  const observedSections = navLinks
    .map((link) => {
      const id = link.getAttribute('href')?.slice(1);
      return id ? document.getElementById(id) : null;
    })
    .filter(Boolean);

  // Reading progress indicator
  const updateProgress = () => {
    if (!progressBar) return;
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;
    progressBar.style.width = `${ratio.toFixed(1)}%`;
  };
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  // Navigation active state via IntersectionObserver
  if ('IntersectionObserver' in window && observedSections.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const targetId = entry.target.id;
            navLinks.forEach((l) => {
              l.classList.toggle('is-active', l.getAttribute('href') === `#${targetId}`);
            });
          }
        });
      },
      { rootMargin: '-24% 0px -64% 0px', threshold: 0 }
    );
    observedSections.forEach((sec) => observer.observe(sec));
  }

  // Mobile Naver Map App Deep-Link Handler (Android intent + iOS nmap:// fallback)
  const ua = navigator.userAgent || '';
  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a.naver-link[data-nmap-query]');
    if (!anchor) return;
    if (!isAndroid && !isIOS) return; // Desktop opens standard web link in new tab

    const query = anchor.dataset.nmapQuery?.trim();
    if (!query) return;

    e.preventDefault();
    const encQuery = encodeURIComponent(query);
    const webUrl = anchor.href || `https://map.naver.com/p/search/${encQuery}`;

    if (isAndroid) {
      const intentUrl =
        `intent://search?query=${encQuery}&appname=travel.webzine` +
        `#Intent;scheme=nmap;package=com.nhn.android.nmap;` +
        `S.browser_fallback_url=${encodeURIComponent(webUrl)};end;`;
      window.location.href = intentUrl;
      return;
    }

    // iOS Safari / Chrome deep-link with safe web fallback
    let appOpened = false;
    const cancelFallback = () => {
      if (document.hidden) appOpened = true;
    };
    const onPageHide = () => {
      appOpened = true;
    };
    document.addEventListener('visibilitychange', cancelFallback);
    window.addEventListener('pagehide', onPageHide, { once: true });

    const appName = encodeURIComponent('https://map.naver.com');
    window.location.href = `nmap://search?query=${encQuery}&appname=${appName}`;

    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', cancelFallback);
      window.removeEventListener('pagehide', onPageHide);
      if (!appOpened) {
        window.location.href = webUrl;
      }
    }, 1300);
  });

  // Selective Itinerary Inclusion / Exclusion Sync across Master Table, Stops, and Budget
  const EXCLUDED_KEY = 'webzine_202611_excluded_stops_v2';
  const masterRows = Array.from(document.querySelectorAll('#masterTableBody tr[data-stop-id]'));
  const stopItems = Array.from(document.querySelectorAll('.stop-item[data-stop-id]'));
  const ticketRows = Array.from(document.querySelectorAll('#ticketsTableBody tr[data-stop-id]'));
  const activeCountEl = document.getElementById('masterActiveCount');
  const dynamicBudgetEl = document.getElementById('dynamicBaseBudget');
  const dynamicBudgetNoteEl = document.getElementById('dynamicBaseNote');
  const hideExcludedBtn = document.getElementById('toggleHideExcludedBtn');
  const resetStopsBtn = document.getElementById('resetStopsBtn');

  let excludedSet = new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(EXCLUDED_KEY) || '[]');
    if (Array.isArray(raw)) excludedSet = new Set(raw);
  } catch {
    excludedSet = new Set();
  }

  let currentDayFilter = 'all';
  let hideExcluded = false;

  const formatWon = (num) => `${num.toLocaleString('ko-KR')}원`;

  const applyMasterTableFilters = () => {
    masterRows.forEach((row) => {
      const stopId = row.dataset.stopId;
      const dayTag = row.dataset.day || '';
      const isExcluded = excludedSet.has(stopId);
      const matchesDay = currentDayFilter === 'all' || dayTag === currentDayFilter;
      const hiddenByOptOut = hideExcluded && isExcluded;
      row.classList.toggle('is-hidden', !(matchesDay && !hiddenByOptOut));
    });
  };

  const syncAllStops = () => {
    let activeCount = 0;
    let totalCost4Pax = 0;
    const paidBreakdown = [];

    masterRows.forEach((row) => {
      const stopId = row.dataset.stopId;
      const isExcluded = excludedSet.has(stopId);
      const cost = Number(row.dataset.cost4pax || 0);
      const shortName = row.dataset.shortName || stopId;

      if (!isExcluded) {
        activeCount += 1;
        totalCost4Pax += cost;
        if (cost > 0) paidBreakdown.push(`${shortName} ${formatWon(cost)}`);
      }

      row.classList.toggle('is-excluded', isExcluded);
      const cb = row.querySelector('input.master-check');
      if (cb) cb.checked = !isExcluded;
      const stateLabel = row.querySelector('.master-state-pill');
      if (stateLabel) {
        stateLabel.textContent = isExcluded ? '제외됨' : (row.dataset.tierLabel || '포함');
        stateLabel.className = `pill master-state-pill ${isExcluded ? 'pill--warn' : 'pill--ok'}`;
      }
    });

    stopItems.forEach((item) => {
      const stopId = item.dataset.stopId;
      const isExcluded = excludedSet.has(stopId);
      item.classList.toggle('is-excluded', isExcluded);
      const btn = item.querySelector('.stop-toggle-btn[data-action="toggle"]');
      if (btn) {
        btn.textContent = isExcluded ? '다시 포함하기' : '이 일정 제외';
        btn.setAttribute('aria-pressed', isExcluded ? 'true' : 'false');
      }
    });

    ticketRows.forEach((tRow) => {
      const stopId = tRow.dataset.stopId;
      const isExcluded = excludedSet.has(stopId);
      tRow.classList.toggle('is-excluded', isExcluded);
    });

    if (activeCountEl) {
      activeCountEl.textContent = `선택된 동선: ${activeCount} / ${masterRows.length}곳`;
    }

    if (dynamicBudgetEl) {
      dynamicBudgetEl.textContent = totalCost4Pax > 0 ? `약 ${formatWon(totalCost4Pax)}` : '0원 (무료 위주)';
    }

    if (dynamicBudgetNoteEl) {
      dynamicBudgetNoteEl.textContent = paidBreakdown.length
        ? `현재 선택된 ${activeCount}곳 기준 (${paidBreakdown.join(' + ')})`
        : `현재 선택된 ${activeCount}곳 모두 무료 입장·주차 구간입니다.`;
    }

    try {
      localStorage.setItem(EXCLUDED_KEY, JSON.stringify(Array.from(excludedSet)));
    } catch {
      // Ignore storage failures
    }

    applyMasterTableFilters();
  };

  const toggleStop = (stopId, forceIncluded) => {
    if (!stopId) return;
    const include = typeof forceIncluded === 'boolean' ? forceIncluded : excludedSet.has(stopId);
    if (include) {
      excludedSet.delete(stopId);
    } else {
      excludedSet.add(stopId);
    }
    syncAllStops();
  };

  masterRows.forEach((row) => {
    const cb = row.querySelector('input.master-check');
    if (cb) {
      cb.addEventListener('change', () => {
        toggleStop(row.dataset.stopId, cb.checked);
      });
    }
  });

  stopItems.forEach((item) => {
    const stopId = item.dataset.stopId;
    item.querySelectorAll('.stop-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const forceInclude = btn.dataset.action === 'restore' ? true : undefined;
        toggleStop(stopId, forceInclude);
      });
    });
  });

  // Master Table Day filters
  const masterFilterGroup = document.getElementById('masterDayFilterBar');
  if (masterFilterGroup) {
    const btns = Array.from(masterFilterGroup.querySelectorAll('.filter-btn'));
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        currentDayFilter = btn.dataset.filter || 'all';
        btns.forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        applyMasterTableFilters();
      });
    });
  }

  if (hideExcludedBtn) {
    hideExcludedBtn.addEventListener('click', () => {
      hideExcluded = !hideExcluded;
      hideExcludedBtn.classList.toggle('is-active', hideExcluded);
      hideExcludedBtn.setAttribute('aria-pressed', hideExcluded ? 'true' : 'false');
      hideExcludedBtn.textContent = hideExcluded ? '제외 일정 다시 보기' : '제외 일정 숨기기';
      applyMasterTableFilters();
    });
  }

  if (resetStopsBtn) {
    resetStopsBtn.addEventListener('click', () => {
      excludedSet.clear();
      hideExcluded = false;
      if (hideExcludedBtn) {
        hideExcludedBtn.classList.remove('is-active');
        hideExcludedBtn.setAttribute('aria-pressed', 'false');
        hideExcludedBtn.textContent = '제외 일정 숨기기';
      }
      syncAllStops();
    });
  }

  syncAllStops();

  // Generic filter controller for ticket rows & gourmet cards
  const bindFilter = (groupId, itemSelector, attrName) => {
    const group = document.getElementById(groupId);
    if (!group) return;
    const buttons = Array.from(group.querySelectorAll('.filter-btn'));
    const items = Array.from(document.querySelectorAll(itemSelector));

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter || 'all';
        buttons.forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        items.forEach((item) => {
          const tags = (item.dataset[attrName] || '').split(/\s+/);
          const show = filter === 'all' || tags.includes(filter);
          item.classList.toggle('is-hidden', !show);
        });
      });
    });
  };

  bindFilter('ticketFilterBar', '.ticket-table tbody tr', 'ticketType');
  bindFilter('foodFilterBar', '.food-card', 'foodTag');

  // Persistent family pre-trip checklist
  const STORAGE_KEY = 'webzine_202611_checklist_v2';
  const checklistEl = document.getElementById('familyChecklist');
  const checkCounterEl = document.getElementById('checkCounter');
  const resetBtn = document.getElementById('resetChecklistBtn');

  if (checklistEl) {
    const boxes = Array.from(checklistEl.querySelectorAll('input[type="checkbox"]'));
    let savedState = {};
    try {
      savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch {
      savedState = {};
    }

    const syncChecklistUI = () => {
      let done = 0;
      const snapshot = {};
      boxes.forEach((box) => {
        const li = box.closest('.check-item');
        if (box.checked) done += 1;
        snapshot[box.id] = box.checked;
        if (li) li.classList.toggle('is-checked', box.checked);
      });
      if (checkCounterEl) {
        checkCounterEl.textContent = `${done} / ${boxes.length} 확인 완료`;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Ignore storage quota errors
      }
    };

    boxes.forEach((box) => {
      if (Object.prototype.hasOwnProperty.call(savedState, box.id)) {
        box.checked = Boolean(savedState[box.id]);
      }
      box.addEventListener('change', syncChecklistUI);
    });
    syncChecklistUI();

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        boxes.forEach((b) => {
          b.checked = false;
        });
        syncChecklistUI();
      });
    }
  }

  // Lightbox image inspection
  const lightbox = document.getElementById('photoLightbox');
  const lbImg = document.getElementById('lightboxImg');
  const lbCaption = document.getElementById('lightboxCaption');
  const lbClose = document.getElementById('lightboxClose');
  let lastTrigger = null;

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    if (lbImg) lbImg.removeAttribute('src');
    if (lastTrigger && typeof lastTrigger.focus === 'function') {
      lastTrigger.focus();
    }
    lastTrigger = null;
  };

  const openLightbox = (triggerEl) => {
    const img = triggerEl.querySelector('img');
    if (!lightbox || !lbImg || !img) return;
    lastTrigger = triggerEl;
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt || '';
    const fig = triggerEl.closest('figure');
    const capText = fig?.querySelector('figcaption')?.textContent?.trim() || triggerEl.dataset.caption || img.alt || '';
    if (lbCaption) lbCaption.textContent = capText;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    if (lbClose) lbClose.focus();
  };

  document.querySelectorAll('.zoomable').forEach((frame) => {
    frame.setAttribute('tabindex', '0');
    frame.setAttribute('role', 'button');
    if (!frame.getAttribute('aria-label')) {
      const alt = frame.querySelector('img')?.alt || '사진 확대 보기';
      frame.setAttribute('aria-label', `${alt} 크게 보기`);
    }
    frame.addEventListener('click', () => openLightbox(frame));
    frame.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(frame);
      }
    });
  });

  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox?.classList.contains('is-open')) {
      closeLightbox();
    }
  });
})();
