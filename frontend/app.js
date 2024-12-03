// 전역 변수 선언
let currentPage = 1;
const moviesPerPage = 20;
const moviesContainer = document.getElementById('movies-container');
const paginationContainer = document.getElementById('pagination');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const countrySelect = document.getElementById('country-select');
const sortSelect = document.getElementById('sort-select');
const releaseStatusSelect = document.getElementById('release-status-select');
let searchQuery = '';
let isLoading = false;
let isMobile = window.innerWidth <= 768;
let hasMorePages = true;

// 모바일 여부 체크 함수
function checkMobile() {
    isMobile = window.innerWidth <= 768;
    paginationContainer.style.display = isMobile ? 'none' : 'flex';
}

// 스크롤 이벤트 핸들러
function handleScroll() {
    if (!isMobile || isLoading || !hasMorePages) return;

    const scrollHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY;
    const clientHeight = document.documentElement.clientHeight;

    if (scrollHeight - scrollTop - clientHeight < 100) {
        fetchMovies(false, true);
    }
}

// 영화 데이터 가져오기
async function fetchMovies(resetPage = false, append = false) {
    if (resetPage) {
        currentPage = 1;
        hasMorePages = true;
    }

    if (isLoading) return;
    isLoading = true;
    showLoading();

    try {
        // 선택된 장르들 가져오기
        const selectedGenres = Array.from(document.querySelectorAll('.genre-checkboxes input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value)
            .join(',');
        
        // API 요청 파라미터 설정
        const params = new URLSearchParams({
            page: currentPage,
            sort: sortSelect.value,
            release_status: releaseStatusSelect.value,
            _t: Date.now() // 캐시 방지를 위한 타임스탬프
        });

        if (selectedGenres) {
            params.append('genre', selectedGenres);
        }

        if (countrySelect.value !== 'all') {
            params.append('region', countrySelect.value);
        }

        if (searchQuery) {
            params.append('query', searchQuery);
        }

        console.log('Fetching movies with params:', Object.fromEntries(params));

        const response = await fetch(`/api/movies?${params}`, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error('영화를 불러오는데 실패했습니다.');
        }

        const data = await response.json();
        
        if (data.results.length === 0) {
            if (!append) {
                moviesContainer.innerHTML = '<div class="no-results">검색 결과가 없습니다.</div>';
                paginationContainer.innerHTML = '';
            }
            hasMorePages = false;
            return;
        }

        // 최대 100페이지로 제한
        const maxPages = Math.min(data.total_pages, 100);
        hasMorePages = currentPage < maxPages;

        displayMovies(data.results, append);
        
        if (!isMobile) {
            updatePagination(maxPages);
        } else if (hasMorePages) {
            // 모바일에서만 다음 페이지 준비
            currentPage++;
        }

        hideLoading();

    } catch (error) {
        console.error('Error fetching movies:', error);
        showError(error.message);
        hideLoading();
    } finally {
        isLoading = false;
    }
}

// 영화 표시
function displayMovies(movies, append = false) {
    if (!append) {
        moviesContainer.innerHTML = '';
    }
    
    let movieGrid = append ? moviesContainer.querySelector('.movie-grid') : null;
    if (!movieGrid) {
        movieGrid = document.createElement('div');
        movieGrid.className = 'movie-grid';
        moviesContainer.appendChild(movieGrid);
    }

    movies.forEach(movie => {
        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';
        
        const posterPath = movie.poster_path
            ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
            : 'https://via.placeholder.com/342x513.png?text=No+Poster';

        const releaseDate = movie.release_date 
            ? new Date(movie.release_date).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : '미정';

        // 제목 표시 로직
        const displayTitle = movie.title;
        const originalTitle = movie.original_title !== movie.title ? movie.original_title : '';
        
        movieCard.innerHTML = `
            <div class="movie-poster-container">
                <img src="${posterPath}" alt="${movie.title}" class="movie-poster" loading="lazy">
            </div>
            <div class="movie-info">
                <h3 title="${movie.title}">${displayTitle}</h3>
                ${originalTitle ? `<p class="original-title">${originalTitle}</p>` : ''}
                <p>평점: ${movie.vote_average.toFixed(1)}</p>
                <p>개봉일: ${releaseDate}</p>
            </div>
        `;

        movieCard.addEventListener('click', () => showMovieDetails(movie.id));
        if (append) {
            movieGrid.appendChild(movieCard);
        } else {
            movieGrid.appendChild(movieCard);
            moviesContainer.appendChild(movieGrid);
        }
    });
}

// 영화 요소 생성
function createMovieElement(movie) {
    const movieElement = document.createElement('div');
    movieElement.className = 'movie-card';
    
    const posterUrl = movie.poster_path 
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : 'https://via.placeholder.com/500x750?text=No+Poster';
    
    const releaseYear = movie.release_date 
        ? new Date(movie.release_date).getFullYear() 
        : '미상';

    const voteAverage = movie.vote_average 
        ? movie.vote_average.toFixed(1) 
        : '평점 없음';

    movieElement.innerHTML = `
        <img src="${posterUrl}" alt="${movie.title}" loading="lazy"
             onerror="this.src='https://via.placeholder.com/500x750?text=No+Poster'">
        <div class="movie-info">
            <h3>${movie.title}</h3>
            <p class="year">${releaseYear}</p>
            <p class="rating"> ${voteAverage}</p>
        </div>
    `;

    movieElement.addEventListener('click', () => showMovieDetails(movie.id));
    return movieElement;
}

// 영화 상세 정보 표시
async function showMovieDetails(movieId) {
    try {
        const response = await fetch(`/api/movies/${movieId}`);
        if (!response.ok) throw new Error('영화 정보를 가져오는데 실패했습니다.');
        
        const movie = await response.json();
        const modal = document.getElementById('movie-modal');
        const modalContent = modal.querySelector('#movie-detail');
        
        const posterPath = movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : 'https://via.placeholder.com/500x750.png?text=No+Poster';
            
        const releaseDate = movie.release_date
            ? new Date(movie.release_date).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : '미정';

        // 감독 정보
        const directors = movie.credits?.crew
            ?.filter(person => person.job === 'Director')
            ?.map(director => director.name)
            ?.join(', ') || '정보 없음';

        // 출연진 정보 (상위 10명)
        const castList = movie.credits?.cast
            ?.slice(0, 10)
            ?.map(actor => `
                <div class="cast-item">
                    <div class="cast-image">
                        <img src="${actor.profile_path 
                            ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
                            : 'https://via.placeholder.com/185x278.png?text=No+Image'
                        }" alt="${actor.name}" loading="lazy">
                    </div>
                    <div class="cast-info">
                        <div class="actor-name">${actor.name}</div>
                        <div class="character-name">${actor.character}</div>
                    </div>
                </div>
            `)
            ?.join('') || '<p>출연진 정보가 없습니다.</p>';

        // 제목 표시 로직
        const displayTitle = movie.title;
        const originalTitle = movie.original_title !== movie.title ? movie.original_title : '';
        const productionCountries = movie.production_countries?.map(country => country.name).join(', ') || '정보 없음';

        modalContent.innerHTML = `
            <div class="modal-header">
                <h2>${displayTitle}</h2>
                ${originalTitle ? `<p class="original-title">${originalTitle}</p>` : ''}
            </div>
            <div class="modal-body">
                <div class="modal-poster">
                    <img src="${posterPath}" alt="${movie.title}">
                </div>
                <div class="modal-info">
                    <p><strong>개봉일:</strong> ${releaseDate}</p>
                    <p><strong>평점:</strong> ${movie.vote_average.toFixed(1)}</p>
                    <p><strong>장르:</strong> ${movie.genres?.map(g => g.name).join(', ') || '정보 없음'}</p>
                    <p><strong>제작 국가:</strong> ${productionCountries}</p>
                    <p><strong>러닝타임:</strong> ${movie.runtime}분</p>
                    <p><strong>감독:</strong> ${directors}</p>
                    <div class="overview">
                        <h3>줄거리</h3>
                        <p>${movie.overview || '줄거리 정보가 없습니다.'}</p>
                    </div>
                    <div class="cast-section">
                        <h3>주요 출연진</h3>
                        <div class="cast-grid">
                            ${castList}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
        
        // 모달 닫기 버튼 이벤트
        const closeBtn = modal.querySelector('.close-modal');
        closeBtn.onclick = () => modal.style.display = 'none';
        
        // 모달 외부 클릭 시 닫기
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
        
    } catch (error) {
        console.error('Error fetching movie details:', error);
        showError('영화 상세 정보를 불러오는데 실패했습니다.');
    }
}

// 유틸리티 함수들
function showLoading() {
    moviesContainer.innerHTML = '<div class="loading">로딩 중...</div>';
}

function hideLoading() {
    const loading = moviesContainer.querySelector('.loading');
    if (loading) loading.remove();
}

function showNoResults() {
    moviesContainer.innerHTML = '<div class="no-results">검색 결과가 없습니다.</div>';
}

function showError(message) {
    moviesContainer.innerHTML = `<div class="error">${message}</div>`;
}

function formatDate(dateString) {
    if (!dateString) return '날짜 정보 없음';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// 테마 관리
function initTheme() {
    // 저장된 테마 또는 시스템 테마 확인
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const currentTheme = savedTheme || systemTheme;
    
    // 테마 적용
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    // 테마 토글 버튼 이벤트 리스너
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
    
    // 시스템 테마 변경 감지
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
        }
    });
}

// 서버 연결 유지 함수
function keepAlive() {
    // 8분(480000ms)마다 서버에 요청을 보냄
    setInterval(() => {
        fetch('/api/movies?page=1&_t=' + Date.now(), {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        }).catch(error => console.log('Keep-alive request failed:', error));
    }, 480000);
}

// 초기화 함수
function initializeApp() {
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('scroll', handleScroll);
    initTheme(); // 테마 초기화
    
    // 서버 연결 유지 기능 시작
    keepAlive();

    // 초기 영화 로드
    fetchMovies();

    // 이벤트 리스너 설정
    releaseStatusSelect.addEventListener('change', () => {
        fetchMovies(true);
    });

    countrySelect.addEventListener('change', () => {
        fetchMovies(true);
    });

    sortSelect.addEventListener('change', () => {
        fetchMovies(true);
    });

    // 장르 체크박스 이벤트 리스너
    document.querySelectorAll('.genre-checkboxes input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const label = checkbox.parentElement;
            if (checkbox.checked) {
                label.classList.add('selected');
            } else {
                label.classList.remove('selected');
            }
            fetchMovies(true);
        });
    });

    // 검색 폼 이벤트 리스너
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        searchQuery = searchInput.value;
        fetchMovies(true);
    });

    // 영화관/스트리밍 링크 버튼 추가
    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
        const ticketLinks = document.createElement('div');
        ticketLinks.className = 'ticket-links';
        
        const links = [
            { name: 'CGV', url: 'http://www.cgv.co.kr', icon: '🎬' },
            { name: '롯데시네마', url: 'https://www.lottecinema.co.kr', icon: '🎥' },
            { name: '메가박스', url: 'https://www.megabox.co.kr', icon: '🎦' },
            { name: '넷플릭스', url: 'https://www.netflix.com/kr', icon: '🍿' }
        ];
        
        links.forEach(link => {
            const button = document.createElement('a');
            button.href = link.url;
            button.className = 'ticket-link-button';
            button.target = '_blank';
            button.rel = 'noopener noreferrer';
            button.innerHTML = `${link.icon} ${link.name}`;
            ticketLinks.appendChild(button);
        });
        
        headerRight.appendChild(ticketLinks);
    }
}

// DOMContentLoaded 이벤트에서 초기화 함수 호출
document.addEventListener('DOMContentLoaded', initializeApp);
