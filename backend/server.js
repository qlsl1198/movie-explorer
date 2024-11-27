import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import NodeCache from 'node-cache';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const cache = new NodeCache({ stdTTL: 7200 }); // Cache for 2 hours
const TMDB_API_KEY = 'd3f12b840887bf5a36dbacd9af040917'; // TMDB API 키
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const PORT = process.env.PORT || 3000;

// CORS 설정
app.use(cors({
    origin: '*', // 모든 출처 허용
    methods: ['GET', 'POST', 'OPTIONS'], // 허용할 HTTP 메서드
    allowedHeaders: ['Content-Type', 'Authorization'] // 허용할 헤더
}));

// 영화 장르 매핑
const genres = {
    '액션': 28,
    '모험': 12,
    '애니메이션': 16,
    '코미디': 35,
    '범죄': 80,
    '다큐멘터리': 99,
    '드라마': 18,
    '가족': 10751,
    '판타지': 14,
    '역사': 36,
    '공포': 27,
    '음악': 10402,
    '미스터리': 9648,
    '로맨스': 10749,
    'SF': 878,
    'TV 영화': 10770,
    '스릴러': 53,
    '전쟁': 10752,
    '서부': 37
};

// 주요 국가 코드 매핑
const countries = {
    '한국': 'KR',
    '미국': 'US',
    '일본': 'JP',
    '중국': 'CN',
    '영국': 'GB',
    '프랑스': 'FR',
    '독일': 'DE',
    '이탈리아': 'IT',
    '스페인': 'ES',
    '인도': 'IN',
    '캐나다': 'CA',
    '호주': 'AU',
    '브라질': 'BR',
    '멕시코': 'MX',
    '러시아': 'RU'
};

// Retry mechanism for API calls
async function fetchWithRetry(url, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
    }
    
    throw lastError;
}

// 영화 상세 정보를 가져오는 함수
async function getMovieDetails(movieId) {
    try {
        const cacheKey = `movie_${movieId}`;
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        const response = await fetch(
            `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&language=ko-KR&append_to_response=credits,videos`
        );
        
        if (!response.ok) {
            throw new Error(`Movie details API error: ${response.status}`);
        }
        
        const data = await response.json();
        cache.set(cacheKey, data);
        return data;
    } catch (error) {
        console.error('Error fetching movie details:', error);
        return null;
    }
}

// 영화 목록 API
app.get('/api/movies', async (req, res) => {
    try {
        const {
            page = 1,
            genre,
            region,
            query,
            sort = 'popularity.desc',
            release_status
        } = req.query;

        let endpoint = query ? 'search/movie' : 'discover/movie';
        
        // TMDB API 파라미터 설정
        const params = new URLSearchParams({
            api_key: TMDB_API_KEY,
            language: 'ko-KR',
            page,
            sort_by: sort,
            include_adult: false,
            'vote_count.gte': 0,
            'with_watch_monetization_types': 'flatrate|free|ads|rent|buy', // 모든 시청 가능한 영화 포함
            'with_release_type': '1|2|3|4|5|6' // 모든 유형의 릴리즈 포함
        });

        // 오늘 날짜 계산 (한국 시간 기준)
        const today = new Date();
        today.setHours(today.getHours() + 9); // UTC+9
        const koreanDate = today.toISOString().split('T')[0];

        // 3개월 전 날짜 계산
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        const threeMonthsAgoDate = threeMonthsAgo.toISOString().split('T')[0];

        // 개봉 상태에 따른 필터링
        if (release_status === 'upcoming') {
            params.append('primary_release_date.gte', koreanDate);
            params.set('sort_by', 'primary_release_date.asc');
            params.set('vote_count.gte', 0); // 개봉예정작은 투표 수 제한 없음
        } else if (release_status === 'released') {
            params.append('primary_release_date.lte', koreanDate);
            params.append('primary_release_date.gte', threeMonthsAgoDate); // 최근 3개월 개봉작
            params.set('vote_count.gte', 10); // 투표 수 제한 낮춤
        } else {
            // 전체 영화 표시할 때는 투표 수 제한만 적용
            params.set('vote_count.gte', 10);
        }

        if (genre) {
            params.append('with_genres', genre);
        }

        if (region && region !== 'all') {
            params.set('region', region);
            params.append('with_origin_country', region);
            
            // 한국 영화의 경우 더 많은 결과를 위해 추가 설정
            if (region === 'KR') {
                params.append('certification_country', 'KR');
            }
        }

        if (query) {
            params.append('query', query);
        }

        // 캐시 방지를 위한 타임스탬프 추가
        params.append('timestamp', Date.now());

        console.log('TMDB API Request:', `${TMDB_BASE_URL}/${endpoint}?${params}`);

        const response = await fetch(`${TMDB_BASE_URL}/${endpoint}?${params}`);

        if (!response.ok) {
            throw new Error(`TMDB API Error: ${response.status}`);
        }

        const data = await response.json();
        
        // 결과 필터링 및 정리
        const result = {
            page: data.page,
            total_pages: Math.min(data.total_pages, 100),
            total_results: data.total_results,
            results: data.results
                .filter(movie => movie.title && (movie.poster_path || movie.backdrop_path))
                .map(movie => ({
                    id: movie.id,
                    title: movie.title,
                    poster_path: movie.poster_path,
                    backdrop_path: movie.backdrop_path,
                    release_date: movie.release_date,
                    vote_average: movie.vote_average,
                    overview: movie.overview,
                    popularity: movie.popularity
                }))
        };

        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Expires': '-1',
            'Pragma': 'no-cache'
        });

        res.json(result);

    } catch (error) {
        console.error('Error in /api/movies:', error);
        res.status(500).json({ error: '영화 데이터를 가져오는데 실패했습니다.' });
    }
});

// 영화 상세 정보 API
app.get('/api/movies/:id', async (req, res) => {
    try {
        const movieId = req.params.id;

        // 영화 상세 정보와 출연진 정보를 동시에 가져오기
        const [movieResponse, creditsResponse] = await Promise.all([
            fetch(`${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=ko-KR`),
            fetch(`${TMDB_BASE_URL}/movie/${movieId}/credits?api_key=${TMDB_API_KEY}&language=ko-KR`)
        ]);

        if (!movieResponse.ok || !creditsResponse.ok) {
            throw new Error('영화 정보를 가져오는데 실패했습니다.');
        }

        const [movieData, creditsData] = await Promise.all([
            movieResponse.json(),
            creditsResponse.json()
        ]);

        // 주요 출연진 (최대 5명)과 감독 정보 추출
        const mainCast = creditsData.cast
            .slice(0, 5)
            .map(actor => ({
                name: actor.name,
                character: actor.character,
                profile_path: actor.profile_path
            }));

        const director = creditsData.crew.find(person => person.job === 'Director');

        // 응답 데이터 구성
        const result = {
            ...movieData,
            cast: mainCast,
            director: director ? director.name : null
        };

        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Expires': '-1',
            'Pragma': 'no-cache'
        });

        res.json(result);

    } catch (error) {
        console.error('Error in /api/movies/:id:', error);
        res.status(500).json({ error: '영화 상세 정보를 가져오는데 실패했습니다.' });
    }
});

// 장르 목록 API
app.get('/api/genres', (req, res) => {
    res.json(genres);
});

// 국가 목록 API
app.get('/api/countries', (req, res) => {
    res.json(countries);
});

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`External: http://1.212.96.50:${PORT}`);
});
