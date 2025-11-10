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
    let currentVideoSrc = null; // Lưu SRC GỐC

    const commentSymbolDisplay = document.getElementById('comment-symbol-display');
    const commentsList = document.getElementById('comments-list');
    const recordButton = document.getElementById('record-button');
    const stopButton = document.getElementById('stop-button');
    const sendCommentButton = document.getElementById('send-comment-button');
    const recordingPreview = document.getElementById('recording-preview');
    const recordStatus = document.getElementById('record-status');
    const commentToggleHeader = document.getElementById('comment-toggle-header');
    const commentContentWrapper = document.getElementById('comment-content-wrapper');
    
    // [HÀM MỚI] Dựa trên SRC gốc và trạng thái, tạo URL đầy đủ
    function buildVimeoUrl(src, autoplay = '1') {
        if (!src) return null;
        
        // 1. Loại bỏ các tham số hiện có (nếu có)
        const baseUrl = src.split('?')[0];
        const urlParams = new URLSearchParams(src.split('?')[1]);
        const hParam = urlParams.get('h');

        // 2. Tạo URL mới và áp dụng tham số
        const videoUrl = new URL(baseUrl);
        if (hParam) {
             videoUrl.searchParams.set('h', hParam);
        }

        // Tham số điều khiển của bạn
        videoUrl.searchParams.set('loop', '1');
        videoUrl.searchParams.set('autoplay', autoplay); // '1' cho Play, '0' cho Pause/Stop
        videoUrl.searchParams.set('controls', '0');
        videoUrl.searchParams.set('title', '0');    
        videoUrl.searchParams.set('byline', '0'); 
        videoUrl.searchParams.set('api', '1');          // <--- THÊM THEO YÊU CẦU
        videoUrl.searchParams.set('player_id', 'vimeo-ifr'); // <--- THÊM THEO YÊU CẦU
        
        return videoUrl.href;
    }

    // [HÀM THAY THẾ createIframe] Tạo hoặc cập nhật iframe
    function loadOrUpdateIframe(src, autoplay = '1') {
        if (!src) return;
        
        const finalUrl = buildVimeoUrl(src, autoplay);
        
        // Kiểm tra xem iframe đã tồn tại chưa
        let iframe = iframeTarget.querySelector('iframe');
        
        if (!iframe) {
            // Nếu chưa tồn tại, tạo mới
            iframeTarget.innerHTML = ''; // Xóa placeholder
            iframe = document.createElement('iframe');
            iframe.title = "Video hướng dẫn";
            iframe.frameBorder = "0";
            iframe.allow = "autoplay; fullscreen; picture-in-picture; web-share";
            iframe.allowFullscreen = true;
            iframeTarget.appendChild(iframe);
        }
        
        // Luôn cập nhật SRC để phản ánh trạng thái mới
        iframe.src = finalUrl;
    }

    // [HÀM THAY THẾ destroyIframe] Chỉ ẩn video và hiện placeholder
    function hideVideoAndShowPlaceholder() {
        // TÌM VÀ CẬP NHẬT iframe (để nó dừng phát - autoplay=0)
        let iframe = iframeTarget.querySelector('iframe');
        if (iframe && currentVideoSrc) {
            // Cập nhật SRC để dừng video trong khi vẫn giữ thẻ
            iframe.src = buildVimeoUrl(currentVideoSrc, '0'); 
        } else {
             // Nếu chưa có iframe, chỉ cần xóa nội dung và hiện placeholder
             iframeTarget.innerHTML = '';
        }
        
        iframeTarget.appendChild(videoPlaceholder);
        // Ẩn container chứa video
        vimeoPlayerContainer.classList.add('video-hidden');
    }

    // Gắn sự kiện cho các nút Play/Pause
    videoPlayBtn.addEventListener('click', () => {
        // HÀNH ĐỘNG KHI NHẤN PLAY: TẢI LẠI VỚI autoplay=1
        if (currentVideoSrc) {
            vimeoPlayerContainer.classList.remove('video-hidden'); 
            loadOrUpdateIframe(currentVideoSrc, '1'); // <--- BẮT ĐẦU PHÁT
            videoPlayBtn.disabled = true;
            videoPauseBtn.disabled = false;
            videoPlaceholder.style.display = 'none'; // Ẩn placeholder
        }
    });
    
    videoPauseBtn.addEventListener('click', () => {
        // HÀNH ĐỘNG KHI NHẤN PAUSE TÙY CHỈNH: CẬP NHẬT SRC VỚI autoplay=0 (DỪNG)
        if (currentVideoSrc) {
            vimeoPlayerContainer.classList.remove('video-hidden'); 
            loadOrUpdateIframe(currentVideoSrc, '0'); // <--- DỪNG PHÁT VÀ GIỮ IFRAME
            videoPlayBtn.disabled = false;
            videoPauseBtn.disabled = true;
            videoPlaceholder.style.display = 'block'; // Hiển thị placeholder
        }
    });

    // Vô hiệu hóa nút bấm ngay từ đầu và ẩn video
    videoPlayBtn.disabled = true;
    videoPauseBtn.disabled = true;
    vimeoPlayerContainer.classList.add('video-hidden');

    // Hàm chuẩn hóa tên ký tự cho Supabase Storage (GIỮ NGUYÊN)
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
            
            // hideVideoAndShowPlaceholder(); // KHÔNG CẦN ẨN MÀ CHỈ DỪNG/TẢI MỚI

            const videoSrc = symbol.dataset.videoSrc;
            currentVideoSrc = videoSrc; // Lưu trữ src GỐC
            
            const guideText = symbol.dataset.guide;

            if (videoSrc) {
                // Tải video MỚI VÀ PHÁT (autoplay=1)
                vimeoPlayerContainer.classList.remove('video-hidden');
                loadOrUpdateIframe(currentVideoSrc, '1'); 
                videoPlaceholder.style.display = 'none'; // Ẩn placeholder khi phát
                
                videoPlayBtn.disabled = true; 
                videoPauseBtn.disabled = false;
                
                guideTextElement.textContent = guideText || "Chưa có hướng dẫn cho ký tự này.";
                
            } else {
                // XỬ LÝ KHI KHÔNG CÓ VIDEO
                hideVideoAndShowPlaceholder(); // Ẩn hoàn toàn nếu không có SRC
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

    // --- LOGIC HOÀN THÀNH KÝ TỰ (GIỮ NGUYÊN) ---
    async function loadCompletionStatus() {
        let userId = localStorage.getItem('user_id');
        if (!userId) {
            userId = 'anonymous_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('user_id', userId);
            console.log("Đã tạo User ID mới cho thiết bị này: " + userId);
        }
        
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
            console.error('Lỗi khi tải trạng thái hoàn thành từ Supabase:', e);
        }
        
        localStorage.removeItem('ipa_completion_status');
    }

    async function saveCompletionStatus(symbol, isCompleted) {
        const userId = localStorage.getItem('user_id');
        if (!userId) {
            console.error("Không có User ID. Không thể lưu trạng thái hoàn thành.");
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
                console.error('Lỗi khi lưu trạng thái hoàn thành vào Supabase:', error);
            }
        } catch (e) {
            console.error('Lỗi ngoại lệ khi lưu trạng thái hoàn thành:', e);
        }
    }

    function toggleCompletion(symbolElement) {
        const ipaKey = symbolElement.dataset.symbol;
        const isCompleted = symbolElement.classList.contains('completed');
        const icon = symbolElement.querySelector('.completion-status-icon');
        
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

    completionIcons.forEach(iconContainer => {
        iconContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            const parentSymbol = iconContainer.closest('.ipa-symbol');
            if (parentSymbol) {
                toggleCompletion(parentSymbol);
            }
        });
    });

    loadCompletionStatus(); 

    // --- CÁC HÀM XỬ LÝ GHI ÂM/SUPABASE (GIỮ NGUYÊN) ---

    // 1. BẮT ĐẦU GHI ÂM
    recordButton.addEventListener('click', async () => {
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

    // 3. GỬI BÌNH LUẬN VÀ UPLOAD
    sendCommentButton.addEventListener('click', async () => {
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
            const uniqueFileName = `${Date.now()}.webm`;
            audioPath = `${safeSymbolName}/${uniqueFileName}`; 
            
            const { error: uploadError } = await sb.storage
                .from(AUDIO_BUCKET_NAME)
                .upload(audioPath, recordedAudioBlob, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const supabaseRef = SUPABASE_URL.split('://')[1].split('.')[0]; 
            audioURL = `https://${supabaseRef}.supabase.co/storage/v1/object/public/${AUDIO_BUCKET_NAME}/${audioPath}`;

            if (!audioURL || audioURL.includes('null')) {
                throw new Error("Lỗi: Không thể xây dựng URL hợp lệ.");
            }

            const { error: dbError } = await sb
                .from('comments')
                .insert([
                    { 
                        symbol: currentSymbol, 
                        audio_url: audioURL,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (dbError) throw dbError;

            recordStatus.textContent = "Gửi thành công!";
            resetCommentForm();
            loadComments(currentSymbol); 

        } catch (err) {
            console.error("Lỗi khi gửi bình luận:", err.message);
            recordStatus.textContent = `Gửi thất bại: ${err.message}`;
            sendCommentButton.disabled = false; 
            
            if (audioPath) {
                 sb.storage.from(AUDIO_BUCKET_NAME).remove([audioPath]);
            }
        }
    });

    // 4. HÀM TẢI BÌNH LUẬN TỪ SUPABASE
    async function loadComments(symbol) {
        commentsList.innerHTML = 'Đang tải bình luận...'; 
        try {
            const { data, error } = await sb
                .from('comments')
                .select('*')
                .eq('symbol', symbol)
                .order('created_at', { ascending: false }); 
            
            if (error) throw error;
            
            commentsList.innerHTML = ''; 
            
            if (data.length === 0) {
                commentsList.innerHTML = '<p>Chưa có bình luận nào cho ký tự này.</p>';
                return;
            }

            data.forEach(comment => {
                displayComment(comment);
            });

        } catch (err) {
            console.error("Lỗi khi tải bình luận:", err.message);
            commentsList.innerHTML = '<p>Không thể tải bình luận.</p>';
        }
    }

    // 5. HÀM HIỂN THỊ 1 BÌNH LUẬN
    function displayComment(data) {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment-item';

        if (data.text && data.text.trim() !== "") {
            const textEl = document.createElement('p');
            textEl.textContent = data.text;
            commentDiv.appendChild(textEl);
        }

        if (data.audio_url) {
            const audioEl = document.createElement('audio');
            audioEl.controls = true;
            audioEl.src = data.audio_url;
            commentDiv.appendChild(audioEl);
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
});
