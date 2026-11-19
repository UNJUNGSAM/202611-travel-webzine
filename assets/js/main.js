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

  // Selective Itinerary Inclusion / Exclusion + Day 3 Course 1/2 Sync
  const EXCLUDED_KEY = 'webzine_202611_excluded_stops_v3';
  const COURSE_KEY = 'webzine_202611_day3_course_v3';
  const masterRows = Array.from(document.querySelectorAll('#masterTableBody tr[data-stop-id]'));
  const stopItems = Array.from(document.querySelectorAll('.stop-item[data-stop-id]'));
  const ticketRows = Array.from(document.querySelectorAll('#ticketsTableBody tr[data-stop-id]'));
  const courseDividers = Array.from(document.querySelectorAll('.course-divider[data-course], .nocturnal-band[data-course]'));
  const courseButtons = Array.from(document.querySelectorAll('.course-btn[data-course-choice], .course-select-card-btn[data-course-choice]'));
  const courseCompareCards = Array.from(document.querySelectorAll('.course-compare-card[data-course-card]'));
  const activeCountEl = document.getElementById('masterActiveCount');
  const dynamicBudgetEl = document.getElementById('dynamicBaseBudget');
  const dynamicBudgetNoteEl = document.getElementById('dynamicBaseNote');
  const dynamicBudgetLabelEl = document.getElementById('dynamicBudgetLabel');
  const hideExcludedBtn = document.getElementById('toggleHideExcludedBtn');
  const resetStopsBtn = document.getElementById('resetStopsBtn');

  let excludedSet = new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(EXCLUDED_KEY) || '[]');
    if (Array.isArray(raw)) excludedSet = new Set(raw);
  } catch {
    excludedSet = new Set();
  }

  let courseChoice = 'both'; // 'both' | 'c1' | 'c2'
  try {
    const savedCourse = localStorage.getItem(COURSE_KEY);
    if (savedCourse === 'both' || savedCourse === 'c1' || savedCourse === 'c2') {
      courseChoice = savedCourse;
    }
  } catch {
    courseChoice = 'both';
  }

  let currentDayFilter = 'all';
  let hideExcluded = false;

  const formatWon = (num) => `${num.toLocaleString('ko-KR')}원`;

  const matchesCourse = (elCourse) => {
    if (!elCourse || elCourse === 'common') return true;
    if (courseChoice === 'both') return true;
    return elCourse === courseChoice;
  };

  const applyCourseUI = () => {
    courseButtons.forEach((btn) => {
      const choice = btn.dataset.courseChoice;
      const active = choice === courseChoice;
      if (btn.classList.contains('course-btn')) {
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      } else {
        btn.textContent = active ? '현재 선택된 코스 ✓' : '이 코스로 확정·필터';
      }
    });

    courseCompareCards.forEach((card) => {
      const c = card.dataset.courseCard;
      card.classList.toggle('is-selected', courseChoice === c);
      card.classList.toggle('is-dimmed', courseChoice !== 'both' && courseChoice !== c);
    });

    masterRows.forEach((row) => {
      row.classList.toggle('is-course-hidden', !matchesCourse(row.dataset.course));
    });
    stopItems.forEach((item) => {
      item.classList.toggle('is-course-hidden', !matchesCourse(item.dataset.course));
    });
    ticketRows.forEach((tRow) => {
      tRow.classList.toggle('is-course-hidden', !matchesCourse(tRow.dataset.course));
    });
    courseDividers.forEach((div) => {
      div.classList.toggle('is-course-hidden', !matchesCourse(div.dataset.course));
    });
  };

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
    applyCourseUI();

    let visibleTotal = 0;
    let activeCount = 0;
    let commonCost = 0;
    let c1Extra = 0;
    let c2Extra = 0;
    const paidCommon = [];
    const paidC1 = [];
    const paidC2 = [];

    masterRows.forEach((row) => {
      const stopId = row.dataset.stopId;
      const courseTag = row.dataset.course || 'common';
      const isExcluded = excludedSet.has(stopId);
      const cost = Number(row.dataset.cost4pax || 0);
      const shortName = row.dataset.shortName || stopId;
      const inCurrentCourse = matchesCourse(courseTag);

      if (inCurrentCourse) {
        visibleTotal += 1;
        if (!isExcluded) activeCount += 1;
      }

      if (!isExcluded) {
        if (courseTag === 'c1') {
          c1Extra += cost;
          if (cost > 0) paidC1.push(`${shortName} ${formatWon(cost)}`);
        } else if (courseTag === 'c2') {
          c2Extra += cost;
          if (cost > 0) paidC2.push(`${shortName} ${formatWon(cost)}`);
        } else {
          commonCost += cost;
          if (cost > 0) paidCommon.push(`${shortName} ${formatWon(cost)}`);
        }
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

    const courseModeText =
      courseChoice === 'c1' ? '코스1 대구' : courseChoice === 'c2' ? '코스2 보은' : '코스1·2 비교';

    if (activeCountEl) {
      activeCountEl.textContent = `활성 동선 (${courseModeText}): ${activeCount} / ${visibleTotal}곳`;
    }

    if (dynamicBudgetEl && dynamicBudgetNoteEl) {
      if (courseChoice === 'c1') {
        const total = commonCost + c1Extra;
        const breakdown = [...paidCommon, ...paidC1];
        if (dynamicBudgetLabelEl) {
          dynamicBudgetLabelEl.textContent = '[코스 1 선택 · 전기차 감면 반영] 4인 필수 입장·주차 합계';
        }
        dynamicBudgetEl.textContent = total > 0 ? `약 ${formatWon(total)}` : '0원 (무료 위주)';
        dynamicBudgetNoteEl.textContent = breakdown.length
          ? `코스 1 공영주차 전기차 50% 감면 기준 (${breakdown.join(' + ')})`
          : `선택된 모든 구간이 무료 입장·주차입니다.`;
      } else if (courseChoice === 'c2') {
        const total = commonCost + c2Extra;
        const breakdown = [...paidCommon, ...paidC2];
        if (dynamicBudgetLabelEl) {
          dynamicBudgetLabelEl.textContent = '[코스 2 선택 · 전기차 감면 반영] 4인 필수 입장·주차 합계';
        }
        dynamicBudgetEl.textContent = total > 0 ? `약 ${formatWon(total)}` : '0원 (무료 위주)';
        dynamicBudgetNoteEl.textContent = breakdown.length
          ? `코스 2 전기차 공영주차 감면 기준 (${breakdown.join(' + ')}) · 세조길(5천)과 청남대(1.8만) 중 미방문 대안 제외 시 약 72,500~85,500원`
          : `선택된 모든 구간이 무료 입장·주차입니다.`;
      } else {
        const totalC1 = commonCost + c1Extra;
        const totalC2 = commonCost + c2Extra;
        if (dynamicBudgetLabelEl) {
          dynamicBudgetLabelEl.textContent = '3일차 코스별 4인 필수 입장·공영주차(전기차 50% 감면) 합계 비교';
        }
        dynamicBudgetEl.textContent = `코스1 약 ${formatWon(totalC1)} / 코스2 약 ${formatWon(totalC2)}`;
        dynamicBudgetNoteEl.textContent =
          `공통·전기차 감면(${paidCommon.join(' + ') || '없음'}) + 코스1(${paidC1.join(' + ') || '무료'}) vs 코스2(${paidC2.join(' + ') || '무료'})`;
      }
    }

    try {
      localStorage.setItem(EXCLUDED_KEY, JSON.stringify(Array.from(excludedSet)));
      localStorage.setItem(COURSE_KEY, courseChoice);
    } catch {
      // Ignore storage failures
    }

    applyMasterTableFilters();
  };

  const setCourseChoice = (nextChoice) => {
    if (nextChoice !== 'both' && nextChoice !== 'c1' && nextChoice !== 'c2') return;
    courseChoice = nextChoice;
    syncAllStops();
  };

  courseButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setCourseChoice(btn.dataset.courseChoice);
    });
  });

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
      courseChoice = 'both';
      currentDayFilter = 'all';
      if (masterFilterGroup) {
        masterFilterGroup.querySelectorAll('.filter-btn').forEach((b) => {
          const isAll = (b.dataset.filter || '') === 'all';
          b.classList.toggle('is-active', isAll);
          b.setAttribute('aria-pressed', isAll ? 'true' : 'false');
        });
      }
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
  const STORAGE_KEY = 'webzine_202611_checklist_v3';
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
