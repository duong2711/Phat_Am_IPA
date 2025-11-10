document.addEventListener('DOMContentLoaded', () => {

    // --- CẤU HÌNH SUPABASE (GIỮ NGUYÊN) ---
    const SUPABASE_URL = 'https://habakuagkfubyzpucfzh.supabase.co'; 
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhYmFrdWFna2Z1Ynl6cHVjZnpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2ODU3NDYsImV4cCI6MjA3ODI2MTc0Nn0.xD8WGjCdPrTZS4HT8ftCszNM4f-cKgbMNBgYtAUf9sg'; 
    const AUDIO_BUCKET_NAME = 'audio_comments'; 
    const ADMIN_PASSWORD = 'admin'; 
    const { createClient } = supabase;
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // ------------------------------------------

    const symbols = document.querySelectorAll('.ipa-symbol');
    const completionIcons = document.querySelectorAll('.completion-container'); 
    
    const vimeoPlayerContainer = document.getElementById('vimeo-player-container');
    const iframeTarget = document.getElementById('iframe-target');
    const videoPlayBtn = document.getElementById('video-play-btn');
    const videoPauseBtn = document.getElementById('video-pause-btn');
    const videoPlaceholder = document.getElementById('video-placeholder');
    const guideTextElement = document.getElementById('guide-text'); 

    let mediaRecorder;
    let audioChunks = [];
    let currentSymbol = ''; 
    let recordedAudioBlob = null; 
    let currentVideoSrc = null; 

    const commentSymbolDisplay = document.getElementById('comment-symbol-display');
    const commentsList = document.getElementById('comments-list');
    const recordButton = document.getElementById('record-button');
    const stopButton = document.getElementById('stop-button');
    const sendCommentButton = document.getElementById('send-comment-button');
    const recordingPreview = document.getElementById('recording-preview');
    const recordStatus = document.getElementById('record-status');
    const commentToggleHeader = document.getElementById('comment-toggle-header');
    const commentContentWrapper = document.getElementById('comment-content-wrapper');
    const authContainer = document.getElementById('auth-container');
    const authStatus = document.getElementById('auth-status');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const ipaChart = document.querySelector('.ipa-chart'); 
    const guideDisplay = document.getElementById('guide-display'); 
    
    let currentUserId = null; 
    let currentEmail = ''; 
    let holdTimer = null; // Thêm biến này

    // --- LOGIC XÁC THỰC (ĐĂNG NHẬP BẮT BUỘC) ---
    async function handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        authStatus.textContent = 'Đang đăng nhập...';
        
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        
        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                 authStatus.textContent = 'Đăng nhập thất bại: Tài khoản hoặc mật khẩu không đúng.';
            } else if (error.message.includes('Email not confirmed')) {
                 authStatus.textContent = 'Lỗi: Email chưa được xác thực. Vui lòng kiểm tra email của bạn.';
            } else {
                 authStatus.textContent = `Lỗi đăng nhập: ${error.message}`;
            }
            return;
        }

        if (data.user) {
            authStatus.textContent = `Đăng nhập thành công! Đang tải dữ liệu...`;
        }
    }

    async function handleLogout() {
        await sb.auth.signOut();
    }

    function updateCommentFormVisibility(user) {
        const commentForm = document.getElementById('new-comment-form');
        if (commentForm) {
            commentForm.style.display = user ? 'flex' : 'none';
        }
        recordStatus.textContent = user ? '' : 'Vui lòng đăng nhập để gửi ghi âm.';
    }


    function updateUIForUser(user) {
        if (user) {
            currentUserId = user.id;
            currentEmail = user.email;
            authContainer.style.display = 'none';
            logoutBtn.style.display = 'block';
            authStatus.textContent = `Đã đăng nhập: ${user.email} (ID: ${user.id.substring(0, 8)}...)`;
            
            ipaChart.style.display = 'grid'; 
            guideDisplay.style.display = 'flex'; 

            // Bổ sung để tải trạng thái hoàn thành ngay lập tức
            loadCompletionStatus(user);

        } else {
            currentUserId = null;
            currentEmail = '';
            authContainer.style.display = 'block';
            logoutBtn.style.display = 'none';
            authStatus.textContent = 'Email: hv1@gmail.com, Mật khẩu: hv1';

            ipaChart.style.display = 'none'; 
            guideDisplay.style.display = 'none'; 
            hideVideoAndShowPlaceholder(); 
        }
        
        updateCommentFormVisibility(user); 
    }

    sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
             updateUIForUser(session?.user);
        }
    });

    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    // --- KẾT THÚC LOGIC XÁC THỰC ---


    // [HÀM VIDEO CŨ] 
    function buildVimeoUrl(src, autoplay = '1') {
        if (!src) return null;
        
        const baseUrl = src.split('?')[0];
        const urlParams = new URLSearchParams(src.split('?')[1]);
        const hParam = urlParams.get('h');

        const videoUrl = new URL(baseUrl);
        if (hParam) {
             videoUrl.searchParams.set('h', hParam);
        }

        videoUrl.searchParams.set('loop', '1');
        videoUrl.searchParams.set('autoplay', autoplay); 
        videoUrl.searchParams.set('controls', '0');
        videoUrl.searchParams.set('title', '0');    
        videoUrl.searchParams.set('byline', '0'); 
        videoUrl.searchParams.set('api', '1');          
        videoUrl.searchParams.set('player_id', 'vimeo-ifr'); 
        
        return videoUrl.href;
    }

    function loadOrUpdateIframe(src, autoplay = '1') {
        if (!src) return;
        
        const finalUrl = buildVimeoUrl(src, autoplay);
        
        let iframe = iframeTarget.querySelector('iframe');
        
        if (!iframe) {
            iframeTarget.innerHTML = ''; 
            iframe = document.createElement('iframe');
            iframe.title = "Video hướng dẫn";
            iframe.frameBorder = "0";
            iframe.allow = "autoplay; fullscreen; picture-in-picture; web-share";
            iframe.allowFullscreen = true;
            iframeTarget.appendChild(iframe);
        }
        
        iframe.src = finalUrl;
    }

    function hideVideoAndShowPlaceholder() {
        let iframe = iframeTarget.querySelector('iframe');
        if (iframe && currentVideoSrc) {
            iframe.src = buildVimeoUrl(currentVideoSrc, '0'); 
        } else {
             iframeTarget.innerHTML = '';
        }
        
        iframeTarget.appendChild(videoPlaceholder);
        vimeoPlayerContainer.classList.add('video-hidden');
    }

    videoPlayBtn.addEventListener('click', () => {
        if (currentVideoSrc) {
            vimeoPlayerContainer.classList.remove('video-hidden'); 
            loadOrUpdateIframe(currentVideoSrc, '1'); 
            videoPlayBtn.disabled = true;
            videoPauseBtn.disabled = false;
            videoPlaceholder.style.display = 'none'; 
        }
    });
    
    videoPauseBtn.addEventListener('click', () => {
        if (currentVideoSrc) {
            vimeoPlayerContainer.classList.remove('video-hidden'); 
            loadOrUpdateIframe(currentVideoSrc, '0'); 
            videoPlayBtn.disabled = false;
            videoPauseBtn.disabled = true;
            videoPlaceholder.style.display = 'block'; 
        }
    });

    videoPlayBtn.disabled = true;
    videoPauseBtn.disabled = true;
    vimeoPlayerContainer.classList.add('video-hidden');

    function getSafeSymbolName(symbol) {
        let safeName = symbol.replace(/:/g, 'L');
        
        safeName = safeName.replace(/ʃ/g, 'sh');
        safeName = safeName.replace(/ʒ/g, 'zh');
        safeName = safeName.replace(/θ/g, 'th');
        safeName = safeName.replace(/ð/g, 'dh');
        safeName = safeName.replace(/ŋ/g, 'ng');
        safeName = safeName.replace(/tʃ/g, 'ch');
        safeName = safeName.replace(/dʒ/g, 'j');
        safeName = safeName.replace(/ʌ/g, 'A');
        safeName = safeName.replace(/ə/g, 'schwa');
        safeName = safeName.replace(/ɪ/g, 'I'); 
        safeName = safeName.replace(/ʊ/g, 'U'); 
        safeName = safeName.replace(/ɜ/g, 'er');
        safeName = safeName.replace(/ɔ/g, 'aw');
        safeName = safeName.replace(/æ/g, 'aE');
        safeName = safeName.replace(/ɑ/g, 'aLong');
        safeName = safeName.replace(/ɒ/g, 'oShort');
        safeName = safeName.replace(/\//g, '');
        safeName = safeName.replace(/ /g, '_');
        return safeName;
    }


    symbols.forEach(symbol => {
        symbol.addEventListener('click', () => {
            
            if (ipaChart.style.display === 'none') {
                 alert("Vui lòng đăng nhập để xem hướng dẫn phát âm.");
                 return;
            }

            const videoSrc = symbol.dataset.videoSrc;
            currentVideoSrc = videoSrc; 
            
            const guideText = symbol.dataset.guide;

            if (videoSrc) {
                vimeoPlayerContainer.classList.remove('video-hidden');
                loadOrUpdateIframe(currentVideoSrc, '1'); 
                videoPlaceholder.style.display = 'none'; 
                
                videoPlayBtn.disabled = true; 
                videoPauseBtn.disabled = false;
                
                guideTextElement.textContent = guideText || "Chưa có hướng dẫn cho ký tự này.";
                
            } else {
                hideVideoAndShowPlaceholder(); 
                guideTextElement.textContent = guideText || "Chưa có hướng dẫn cho ký tự này.";
                
                videoPlayBtn.disabled = true; 
                videoPauseBtn.disabled = true;
            }

            symbols.forEach(s => s.classList.remove('active'));
            symbol.classList.add('active');
            
            const originalSymbol = symbol.dataset.symbol; 
            currentSymbol = originalSymbol; 
            commentSymbolDisplay.textContent = originalSymbol;
            
            commentToggleHeader.classList.remove('collapsed');
            commentContentWrapper.classList.remove('collapsed');

            loadComments(currentSymbol); 
            resetCommentForm();
        });
    });

    commentToggleHeader.addEventListener('click', () => {
        commentToggleHeader.classList.toggle('collapsed');
        commentContentWrapper.classList.toggle('collapsed');
    });

    // --- LOGIC HOÀN THÀNH KÝ TỰ ---
    
    async function loadCompletionStatus(user) {
        if (!user) {
            symbols.forEach(symbolElement => {
                symbolElement.classList.remove('completed');
                const iconElement = symbolElement.querySelector('.completion-status-icon');
                if (iconElement) iconElement.textContent = '☐';
            });
            return;
        }
        
        const userId = user.id;

        try {
            const { data, error } = await sb
                .from('ipa_completions')
                .select('symbol, completed')
                .eq('user_id', userId);

            if (error) throw error;

            symbols.forEach(symbolElement => {
                const ipaKey = symbolElement.dataset.symbol;
                const match = data.find(item => item.symbol === ipaKey && item.completed);
                const iconElement = symbolElement.querySelector('.completion-status-icon');

                symbolElement.classList.remove('completed');
                if (iconElement) iconElement.textContent = '☐';
                
                if (match) {
                    symbolElement.classList.add('completed');
                    if (iconElement) iconElement.textContent = '✔';
                }
            });

        } catch (e) {
            console.error('Lỗi khi tải trạng thái hoàn thành từ Supabase (Kiểm tra RLS SELECT và cột user_id trên ipa_completions):', e);
        }
    }

    async function saveCompletionStatus(symbol, isCompleted) {
        const userId = currentUserId; 
        
        if (!userId) {
            alert("Vui lòng đăng nhập để đánh dấu hoàn thành!");
            return;
        }
        
        const statusData = {
            user_id: userId,
            symbol: symbol,
            completed: isCompleted,
            updated_at: new Date().toISOString()
        };

        try {
            const { error } = await sb
                .from('ipa_completions')
                .upsert(statusData, { onConflict: 'user_id, symbol' }); 

            if (error) {
                console.error('Lỗi khi lưu trạng thái hoàn thành vào Supabase (Kiểm tra chính sách RLS UPDATE/INSERT trên ipa_completions):', error);
            }
        } catch (e) {
            console.error('Lỗi ngoại lệ khi lưu trạng thái hoàn thành:', e);
        }
    }

    function toggleCompletion(symbolElement) {
        const ipaKey = symbolElement.dataset.symbol;
        const isCompleted = symbolElement.classList.contains('completed');
        const icon = symbolElement.querySelector('.completion-status-icon');

        if (!currentUserId) {
            alert("Vui lòng đăng nhập để đánh dấu hoàn thành!");
            return;
        }
        
        let action = isCompleted ? "hủy đánh dấu hoàn thành" : "đánh dấu hoàn thành";
        
        const enteredPassword = prompt(`Vui lòng nhập mật khẩu Admin để ${action} cho ký tự /${ipaKey}/:`);
        
        if (enteredPassword === ADMIN_PASSWORD) {
            const newCompletedState = !isCompleted;
            
            if (newCompletedState) {
                symbolElement.classList.add('completed');
                if (icon) icon.textContent = '✔';
            } else {
                symbolElement.classList.remove('completed');
                if (icon) icon.textContent = '☐';
            }
            
            saveCompletionStatus(ipaKey, newCompletedState);

        } else if (enteredPassword !== null) {
            alert("Mật khẩu không đúng.");
        }
    }

    // Đã thay đổi logic để yêu cầu click và giữ 3 giây:
    completionIcons.forEach(iconContainer => {
        
        const parentSymbol = iconContainer.closest('.ipa-symbol');
        if (!parentSymbol) return;

        // Bắt đầu giữ chuột
        iconContainer.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            
            // Clear bất kỳ timer cũ nào nếu có lỗi
            if (holdTimer) clearTimeout(holdTimer);

            // Thiết lập timer 3 giây (3000ms)
            holdTimer = setTimeout(() => {
                holdTimer = null; // Reset timer sau khi kích hoạt
                
                // Kích hoạt logic hoàn thành chỉ khi giữ đủ 3 giây
                toggleCompletion(parentSymbol);
                
                // Tạm thời vô hiệu hóa con trỏ để tránh kích hoạt lại ngay lập tức
                iconContainer.style.pointerEvents = 'none';
                setTimeout(() => {
                    iconContainer.style.pointerEvents = 'auto';
                }, 500); // 0.5 giây chờ để tránh double-click/nhả chuột nhanh
                
            }, 3000); // 3 giây
        });

        // Nhả chuột (ngắt quá trình giữ)
        iconContainer.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
        });

        // Rê chuột ra khỏi khu vực (ngắt quá trình giữ)
        iconContainer.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
        });
    });


    // --- CÁC HÀM XỬ LÝ GHI ÂM/SUPABASE ---

    // 1. BẮT ĐẦU GHI ÂM
    recordButton.addEventListener('click', async () => {
        if (!currentUserId) {
             alert("Vui lòng đăng nhập để gửi ghi âm.");
             return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);

            mediaRecorder.onstop = () => {
                recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' }); 
                const audioUrl = URL.createObjectURL(recordedAudioBlob);
                recordingPreview.src = audioUrl; 
                recordingPreview.style.display = 'block';

                recordButton.disabled = false;
                stopButton.disabled = true;
                sendCommentButton.disabled = false;
                recordStatus.textContent = "Sẵn sàng để gửi! Bạn có thể nghe thử ở trên.";
            };

            audioChunks = []; 
            recordedAudioBlob = null;
            mediaRecorder.start();

            recordButton.disabled = true;
            stopButton.disabled = false;
            sendCommentButton.disabled = true;
            recordingPreview.style.display = 'none';
            recordStatus.textContent = "🔴 Đang ghi âm... Bấm 'Dừng' khi xong.";

        } catch (err) {
            console.error("Lỗi khi lấy micro:", err);
            recordStatus.textContent = "Không thể truy cập micro. Vui lòng cho phép quyền truy cập.";
        }
    });

    // 2. DỪNG GHI ÂM
    stopButton.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    });

    // 3. GỬI ghi âm VÀ UPLOAD
    sendCommentButton.addEventListener('click', async () => {
        if (!currentUserId) {
            alert("Vui lòng đăng nhập để gửi ghi âm.");
            return;
        }
        
        if (!recordedAudioBlob) {
            alert("Bạn chưa ghi âm.");
            return;
        }

        const MAX_FILE_SIZE_BYTES = 500 * 1024; 
        
        if (recordedAudioBlob.size > MAX_FILE_SIZE_BYTES) {
            alert(`File ghi âm quá lớn (${(recordedAudioBlob.size / 1024).toFixed(1)} KB). Kích thước tối đa là 500 KB.`);
            recordStatus.textContent = "❌ File quá lớn. Vui lòng ghi âm ngắn hơn.";
            sendCommentButton.disabled = false;
            return;
        }

        sendCommentButton.disabled = true;
        recordStatus.textContent = "Đang tải lên Supabase, vui lòng chờ...";
        let audioURL = null;
        let audioPath = null;
        
        const safeSymbolName = getSafeSymbolName(currentSymbol); 

        try {
            const uniqueFileName = `${currentUserId.substring(0, 8)}_${Date.now()}.webm`; 
            audioPath = `${safeSymbolName}/${uniqueFileName}`; 
            
            // 1. Tải file lên Storage
            const { error: uploadError } = await sb.storage
                .from(AUDIO_BUCKET_NAME)
                .upload(audioPath, recordedAudioBlob, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Lấy URL công khai
            const supabaseRef = SUPABASE_URL.split('://')[1].split('.')[0]; 
            audioURL = `https://${supabaseRef}.supabase.co/storage/v1/object/public/${AUDIO_BUCKET_NAME}/${audioPath}`;

            if (!audioURL || audioURL.includes('null')) {
                throw new Error("Lỗi: Không thể xây dựng URL hợp lệ.");
            }

            // 2. Chèn URL vào DB
            const { error: dbError } = await sb
                .from('comments')
                .insert([
                    { 
                        symbol: currentSymbol, 
                        audio_url: audioURL,
                        user_id: currentUserId, 
                        created_at: new Date().toISOString()
                    }
                ]);

            if (dbError) throw dbError;

            recordStatus.textContent = "Gửi thành công!";
            resetCommentForm();
            loadComments(currentSymbol); 

        } catch (err) {
            console.error("Lỗi khi gửi ghi âm (Kiểm tra RLS INSERT và cột user_id trên comments):", err.message);
            recordStatus.textContent = `Gửi thất bại: ${err.message}`;
            sendCommentButton.disabled = false; 
            
            if (audioPath) {
                 sb.storage.from(AUDIO_BUCKET_NAME).remove([audioPath]);
            }
        }
    });

    // 4. HÀM TẢI ghi âm TỪ SUPABASE (Đã bỏ chặn kiểm tra đăng nhập)
    async function loadComments(symbol) {
        
        if (!symbol) return; 

        commentsList.innerHTML = 'Đang tải ghi âm...'; 
        
        // Hiển thị cảnh báo gửi, nhưng vẫn cho phép tải
        if (!currentUserId) {
            commentsList.innerHTML = '<p>ghi âm đang tải (Vui lòng đăng nhập để gửi).</p>';
        }

        try {
            const { data, error } = await sb
                .from('comments')
                .select('*')
                .eq('symbol', symbol)
                .order('created_at', { ascending: false }); 
            
            if (error) throw error;
            
            commentsList.innerHTML = ''; 
            
            if (data.length === 0) {
                commentsList.innerHTML = '<p>Chưa có ghi âm nào. Practice makes perfect</p>';
                return;
            }

            data.forEach(comment => {
                displayComment(comment);
            });

        } catch (err) {
            console.error("Lỗi khi tải ghi âm:", err.message);
            commentsList.innerHTML = '<p>Không thể tải ghi âm. Kiểm tra RLS SELECT trên comments.</p>';
        }
    }

    // 5. HÀM HIỂN THỊ 1 ghi âm (Đã kiểm tra URL)
    function displayComment(data) {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment-item';

        const senderInfo = document.createElement('div');
        senderInfo.className = 'comment-sender';
        
        let senderDisplay = 'Ẩn danh';
        if (data.user_id) {
             senderDisplay = `Người dùng: ID ${data.user_id.substring(0, 8)}...`; 
        }
        senderInfo.textContent = senderDisplay;
        commentDiv.appendChild(senderInfo);


        if (data.text && data.text.trim() !== "") {
            const textEl = document.createElement('p');
            textEl.textContent = data.text;
            commentDiv.appendChild(textEl);
        }

        // [QUAN TRỌNG] Logic hiển thị audio
        if (data.audio_url) {
            const audioEl = document.createElement('audio');
            audioEl.controls = true;
            audioEl.src = data.audio_url; 
            
            // Kiểm tra URL có bị hỏng không (tùy chọn)
            if (data.audio_url.length > 5) {
                commentDiv.appendChild(audioEl);
            } else {
                 // Ghi nhận lỗi hiển thị audio
                 const errorEl = document.createElement('div');
                 errorEl.textContent = "(Lỗi: URL ghi âm bị hỏng)";
                 errorEl.style.color = 'red';
                 commentDiv.appendChild(errorEl);
            }
        }

        if (data.created_at) { 
            const timeEl = document.createElement('div');
            timeEl.className = 'comment-timestamp';
            timeEl.textContent = new Date(data.created_at).toLocaleString("vi-VN");
            commentDiv.appendChild(timeEl);
        }

        if (data.audio_url || (data.text && data.text.trim() !== "")) {
             commentsList.appendChild(commentDiv);
        }
    }

    // 6. HÀM RESET FORM
    function resetCommentForm() {
        recordingPreview.style.display = 'none';
        recordingPreview.src = '';
        recordStatus.textContent = '';
        
        audioChunks = [];
        recordedAudioBlob = null;
        
        recordButton.disabled = false;
        stopButton.disabled = true;
        sendCommentButton.disabled = true; 
    }
    
    // --- KHỞI TẠO VÀ TẢI TRẠNG THÁI NGAY LẬP TỨC ---
    async function initialLoad() {
        const { data: { session } } = await sb.auth.getSession();
        updateUIForUser(session?.user);
    }
    
    initialLoad();

});
