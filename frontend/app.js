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

// 영화 데이터 가져오기
async function fetchMovies(resetPage = false) {
    if (resetPage) {
        currentPage = 1;
    }

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
            moviesContainer.innerHTML = '<div class="no-results">검색 결과가 없습니다.</div>';
            paginationContainer.innerHTML = '';
            return;
        }

        displayMovies(data.results);
        updatePagination(data.total_pages);
        hideLoading();

    } catch (error) {
        console.error('Error fetching movies:', error);
        showError(error.message);
        hideLoading();
    }
}

// 페이지네이션 업데이트
function updatePagination(totalPages) {
    paginationContainer.innerHTML = '';
    
    // 최대 100페이지로 제한
    totalPages = Math.min(totalPages, 100);
    
    if (totalPages <= 1) {
        return;
    }

    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // 시작 페이지 조정
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // 첫 페이지 버튼
    if (startPage > 1) {
        addPageButton(1, '처음');
        if (startPage > 2) {
            paginationContainer.appendChild(document.createTextNode('...'));
        }
    }

    // 페이지 버튼
    for (let i = startPage; i <= endPage; i++) {
        addPageButton(i);
    }

    // 마지막 페이지 버튼
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationContainer.appendChild(document.createTextNode('...'));
        }
        addPageButton(totalPages, '마지막');
    }
}

// 페이지 버튼 추가
function addPageButton(pageNum, label = pageNum) {
    const button = document.createElement('button');
    button.textContent = label;
    button.classList.add('page-button');
    if (pageNum === currentPage) {
        button.classList.add('active');
    }
    button.addEventListener('click', () => {
        if (pageNum !== currentPage) {
            currentPage = pageNum;
            fetchMovies();
        }
    });
    paginationContainer.appendChild(button);
}

// 영화 표시
function displayMovies(movies) {
    moviesContainer.innerHTML = '';
    
    const movieGrid = document.createElement('div');
    movieGrid.className = 'movie-grid';

    movies.forEach(movie => {
        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';
        
        const posterPath = movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : 'https://via.placeholder.com/300x450.png?text=No+Poster';

        const releaseDate = movie.release_date 
            ? new Date(movie.release_date).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : '미정';

        movieCard.innerHTML = `
            <img src="${posterPath}" alt="${movie.title}" class="movie-poster" loading="lazy">
            <div class="movie-info">
                <h3 title="${movie.title}">${movie.title}</h3>
                <p>평점: ${movie.vote_average.toFixed(1)}</p>
                <p>개봉일: ${releaseDate}</p>
            </div>
        `;

        movieCard.addEventListener('click', () => showMovieDetails(movie.id));
        movieGrid.appendChild(movieCard);
    });

    moviesContainer.appendChild(movieGrid);
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
        if (!response.ok) {
            throw new Error('영화 상세 정보를 가져오는데 실패했습니다.');
        }

        const movie = await response.json();
        const modal = document.getElementById('movie-modal');
        const movieDetail = document.getElementById('movie-detail');
        
        // 출연진 HTML 생성
        const castHTML = movie.cast ? movie.cast.map(actor => `
            <div class="cast-member">
                <img src="${actor.profile_path 
                    ? `https://image.tmdb.org/t/p/w92${actor.profile_path}`
                    : 'https://via.placeholder.com/92x138.png?text=No+Image'}" 
                    alt="${actor.name}" 
                    class="cast-image">
                <div class="cast-info">
                    <div class="actor-name">${actor.name}</div>
                    <div class="character-name">${actor.character}</div>
                </div>
            </div>
        `).join('') : '';

        const releaseDate = movie.release_date 
            ? new Date(movie.release_date).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : '미정';

        movieDetail.innerHTML = `
            <div class="movie-details-container">
                <div class="movie-poster">
                    <img src="${movie.poster_path 
                        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                        : 'https://via.placeholder.com/500x750.png?text=No+Poster'}" 
                        alt="${movie.title}">
                </div>
                <div class="movie-info">
                    <h2>${movie.title}</h2>
                    <p><strong>개봉일:</strong> ${releaseDate}</p>
                    <p><strong>평점:</strong> ${movie.vote_average ? movie.vote_average.toFixed(1) : '정보 없음'}</p>
                    <p><strong>감독:</strong> ${movie.director || '정보 없음'}</p>
                    <p><strong>장르:</strong> ${movie.genres ? movie.genres.map(genre => genre.name).join(', ') : '정보 없음'}</p>
                    <p><strong>러닝타임:</strong> ${movie.runtime ? `${movie.runtime}분` : '정보 없음'}</p>
                    <div class="overview">
                        <strong>줄거리:</strong>
                        <p>${movie.overview || '줄거리 정보가 없습니다.'}</p>
                    </div>
                    ${movie.cast ? `
                        <div class="cast-section">
                            <h3>주요 출연진</h3>
                            <div class="cast-list">
                                ${castHTML}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        modal.style.display = 'block';

        // 닫기 버튼 이벤트 리스너
        const closeBtn = modal.querySelector('.close-modal');
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };

        // 모달 바깥 클릭시 닫기
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };

    } catch (error) {
        console.error('Error showing movie details:', error);
        alert('영화 상세 정보를 불러오는데 실패했습니다.');
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

// 초기화 함수
function initializeApp() {
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
}

// DOMContentLoaded 이벤트에서 초기화 함수 호출
document.addEventListener('DOMContentLoaded', initializeApp);
