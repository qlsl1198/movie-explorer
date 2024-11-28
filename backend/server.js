import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';

// .env 파일 로드
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const cache = new NodeCache({ stdTTL: 7200 }); // Cache for 2 hours
const TMDB_API_KEY = process.env.TMDB_API_KEY; // API 키를 환경 변수로 이동
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const PORT = process.env.PORT || 3000;

// API 키 확인
if (!TMDB_API_KEY) {
    console.error('TMDB_API_KEY is not set in environment variables');
    process.exit(1);
}

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
            // 지역 기반 검색 파라미터 설정
            params.append('with_origin_country', region);
            
            // 한국 영화의 경우 추가 파라미터
            if (region === 'KR') {
                params.append('with_original_language', 'ko');
                // 한국에서 제작 또는 배급된 영화 포함
                params.append('certification_country', 'KR');
                // 투표 수 제한 낮춤 (한국 영화는 TMDB에서 투표가 적을 수 있음)
                params.set('vote_count.gte', 0);
                // 한국어로 검색
                params.set('language', 'ko-KR');
            } else if (region === 'JP') {
                params.append('with_original_language', 'ja');
            } else if (region === 'CN') {
                params.append('with_original_language', ['zh', 'cn'].join('|'));
            }
            
            // 해당 국가에서 개봉된 영화도 포함
            params.append('region', region);
        }

        if (query) {
            params.append('query', query);
            // 검색어가 있을 경우 지역 설정
            if (region && region !== 'all') {
                params.append('region', region);
                // 한국어 검색 최적화
                if (region === 'KR') {
                    params.set('language', 'ko-KR');
                    // 한국어 검색어에 대해 원어 제목도 검색
                    if (endpoint === 'search/movie') {
                        params.append('include_adult', 'false');
                        params.append('include_video', 'false');
                        params.set('vote_count.gte', 0);
                    }
                } else if (region === 'JP') {
                    params.set('language', 'ja-JP');
                } else if (region === 'CN') {
                    params.set('language', 'zh-CN');
                }
            }
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
                .filter(movie => {
                    // 기본적인 유효성 검사
                    if (!movie.title) return false;
                    
                    // 국가별 필터링
                    if (region && region !== 'all') {
                        // 제작 국가 확인
                        const isFromRegion = movie.production_countries?.some(country => 
                            country.iso_3166_1 === region
                        ) || movie.origin_country?.includes(region);
                        
                        // 원어 확인
                        const hasCorrectLanguage = (
                            (region === 'KR' && movie.original_language === 'ko') ||
                            (region === 'JP' && movie.original_language === 'ja') ||
                            (region === 'CN' && ['zh', 'cn'].includes(movie.original_language)) ||
                            (!['KR', 'JP', 'CN'].includes(region))
                        );
                        
                        return isFromRegion || hasCorrectLanguage;
                    }
                    
                    return true;
                })
                .map(movie => ({
                    id: movie.id,
                    title: movie.title,
                    original_title: movie.original_title,
                    poster_path: movie.poster_path,
                    backdrop_path: movie.backdrop_path,
                    overview: movie.overview,
                    release_date: movie.release_date,
                    vote_average: movie.vote_average,
                    original_language: movie.original_language,
                    production_countries: movie.production_countries,
                    genre_ids: movie.genre_ids
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

// 영화 상세 정보 엔드포인트
app.get('/api/movies/:id', async (req, res) => {
    try {
        const movieId = req.params.id;
        const cacheKey = `movie_${movieId}`;
        
        // 캐시된 데이터 확인
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            return res.json(cachedData);
        }

        // 영화 상세 정보와 출연진 정보를 가져오기
        const movieUrl = `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=ko-KR`;
        const creditsUrl = `${TMDB_BASE_URL}/movie/${movieId}/credits?api_key=${TMDB_API_KEY}&language=ko-KR`;

        try {
            const [movieResponse, creditsResponse] = await Promise.all([
                fetch(movieUrl),
                fetch(creditsUrl)
            ]);

            if (!movieResponse.ok || !creditsResponse.ok) {
                throw new Error('영화 정보를 가져오는데 실패했습니다.');
            }

            const [movieData, creditsData] = await Promise.all([
                movieResponse.json(),
                creditsResponse.json()
            ]);

            // 응답 데이터 구성
            const responseData = {
                ...movieData,
                credits: creditsData
            };

            // 캐시에 저장 (2시간)
            cache.set(cacheKey, responseData, 7200);

            res.json(responseData);
        } catch (error) {
            console.error('Error fetching movie data:', error);
            throw error;
        }
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
