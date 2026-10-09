(() => {
  const cfg = window.PINKPOP_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("PASTE_YOUR") && !cfg.SUPABASE_ANON_KEY.includes("PASTE_YOUR");
  const $ = s => document.querySelector(s);
  const views = ["homeView","authView","dashboardView","createView","detailView","takeView","scoreView"].map(id => $("#"+id));
  let supabase = null, user = null, authMode = "login", editorQuestions = [], currentQuiz = null;
  let takeQuestionIndex = 0, takeAnswers = [], lastScoreText = "";
  const icons = ["🌸","🧸","✨","🦋","🌈","🍓","☁️","🎧","🌷","💫","🍒","⭐"];
  const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function show(view) { views.forEach(v => v.classList.add("hidden")); $("#"+view).classList.remove("hidden"); window.scrollTo({top:0,behavior:"smooth"}); }
  function status(id, message, error=false) { const el=$("#"+id); el.textContent=message; el.classList.toggle("error",error); }
  function requireConfig() {
    if (!configured || !window.supabase) {
      show("homeView");
      alert("Almost ready! Add your Supabase Project URL and anon/public key in config.js, then run the SQL in supabase-schema.sql. Setup steps are in README.md.");
      return false;
    }
    return true;
  }
  async function init() {
    if (configured && window.supabase) {
      supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      const {data} = await supabase.auth.getSession();
      user = data.session?.user || null;
      supabase.auth.onAuthStateChange((_event, session) => { user=session?.user||null; updateAuthUI(); });
    }
    updateAuthUI();
    const params = new URLSearchParams(location.search);
    const quizId = params.get("quiz");
    if (quizId) await loadPublicQuiz(quizId);
    else show(user ? "dashboardView" : "homeView");
    if (user) await loadMyQuizzes();
  }
  function updateAuthUI() { $("#logoutBtn").classList.toggle("hidden", !user); }
  function showAuth(mode="login") {
    if (!requireConfig()) return;
    authMode=mode;
    $("#loginTab").classList.toggle("active",mode==="login");
    $("#signupTab").classList.toggle("active",mode==="signup");
    $("#authSubmit").textContent=mode==="login"?"Log in →":"Create account →";
    $("#authPassword").autocomplete=mode==="login"?"current-password":"new-password";
    status("authStatus","");
    show("authView");
  }
  $("#createCta").addEventListener("click",()=> user ? show("dashboardView") : showAuth("signup"));
  $("#authBack").addEventListener("click",()=>show("homeView"));
  $("#loginTab").addEventListener("click",()=>showAuth("login"));
  $("#signupTab").addEventListener("click",()=>showAuth("signup"));
  $("#authForm").addEventListener("submit",async e=>{
    e.preventDefault(); if(!requireConfig()) return;
    const email=$("#authEmail").value.trim(), password=$("#authPassword").value;
    status("authStatus",authMode==="login"?"Logging in…":"Creating your account…");
    const res=authMode==="login" ? await supabase.auth.signInWithPassword({email,password}) : await supabase.auth.signUp({email,password});
    if(res.error){status("authStatus",res.error.message,true);return;}
    user=res.data.user;
    if(authMode==="signup" && !res.data.session){status("authStatus","Account created! Check your email to confirm it, then log in.");return;}
    status("authStatus","You're in! ✨"); await loadMyQuizzes(); show("dashboardView");
  });
  $("#logoutBtn").addEventListener("click",async()=>{if(supabase) await supabase.auth.signOut();user=null;updateAuthUI();show("homeView");});
  $("#newQuizBtn").addEventListener("click",openBuilder);
  $("#emptyCreateBtn").addEventListener("click",openBuilder);
  $("#createBack").addEventListener("click",()=>show("dashboardView"));
  $("#detailBack").addEventListener("click",()=>{history.replaceState({}, "", location.pathname);show("dashboardView");});
  function openBuilder(){if(!user){showAuth("signup");return;} editorQuestions=[];addQuestion();addQuestion();$("#quizTitle").value="";$("#quizDescription").value="";status("createStatus","");show("createView");}
  function addQuestion(data={text:"",options:["","","",""],correct:0}){
    if(editorQuestions.length>=20){status("createStatus","Maximum 20 questions per quiz.",true);return;}
    editorQuestions.push({text:data.text||"",options:[...(data.options||["","","",""])].slice(0,4),correct:Number(data.correct||0)});
    renderQuestionEditor();
  }
  function renderQuestionEditor(){
    const host=$("#questionEditor");host.replaceChildren();
    editorQuestions.forEach((q,qi)=>{
      const block=document.createElement("div");block.className="question-block";
      block.innerHTML=`<div class="question-block-head"><span>Question ${qi+1}</span><button class="remove-q" type="button" data-remove="${qi}" ${editorQuestions.length<=2?"disabled":""}>Remove</button></div>
        <label>Question text<input maxlength="180" required data-qtext="${qi}" value="${escapeHtml(q.text)}" placeholder="What is your favourite…?"></label>
        <div class="option-editor">${q.options.map((opt,oi)=>`<div class="option-row"><input required maxlength="100" data-option="${qi}-${oi}" value="${escapeHtml(opt)}" placeholder="Answer choice ${oi+1}"><label class="correct-choice"><input type="radio" name="correct-${qi}" data-correct="${qi}-${oi}" ${q.correct===oi?"checked":""}> Right answer</label></div>`).join("")}</div>`;
      host.append(block);
    });
    host.querySelectorAll("[data-remove]").forEach(btn=>btn.addEventListener("click",()=>{if(editorQuestions.length>2){editorQuestions.splice(Number(btn.dataset.remove),1);renderQuestionEditor();}}));
    host.querySelectorAll("[data-qtext]").forEach(el=>el.addEventListener("input",()=>editorQuestions[+el.dataset.qtext].text=el.value));
    host.querySelectorAll("[data-option]").forEach(el=>el.addEventListener("input",()=>{const [qi,oi]=el.dataset.option.split("-").map(Number);editorQuestions[qi].options[oi]=el.value;}));
    host.querySelectorAll("[data-correct]").forEach(el=>el.addEventListener("change",()=>{const [qi,oi]=el.dataset.correct.split("-").map(Number);editorQuestions[qi].correct=oi;}));
  }
  $("#addQuestionBtn").addEventListener("click",()=>addQuestion());
  $("#quizForm").addEventListener("submit",async e=>{
    e.preventDefault();if(!user||!supabase)return;
    const title=$("#quizTitle").value.trim(), description=$("#quizDescription").value.trim();
    const questions=editorQuestions.map(q=>({text:q.text.trim(),options:q.options.map(o=>o.trim()),correct:q.correct}));
    if(questions.length<2||questions.length>20){status("createStatus","Add between 2 and 20 questions.",true);return;}
    const invalid=questions.findIndex(q=>!q.text||q.options.some(o=>!o));
    if(invalid!==-1){status("createStatus",`Please fill in the question and all four choices for question ${invalid+1}.`,true);return;}
    $("#saveQuizBtn").disabled=true;status("createStatus","Saving your quiz…");
    const {data,error}=await supabase.from("quizzes").insert({owner_id:user.id,title,description,questions}).select().single();
    $("#saveQuizBtn").disabled=false;
    if(error){status("createStatus",error.message,true);return;}
    await loadMyQuizzes();await openQuizDashboard(data.id);
  });
  async function loadMyQuizzes(){
    if(!supabase||!user)return;
    const {data,error}=await supabase.from("quizzes").select("id,title,description,questions,created_at").eq("owner_id",user.id).order("created_at",{ascending:false});
    if(error){show("dashboardView");$("#quizList").innerHTML=`<p class="status error">${escapeHtml(error.message)}</p>`;return;}
    const host=$("#quizList");host.replaceChildren();$("#emptyQuizzes").classList.toggle("hidden",!!data?.length);
    (data||[]).forEach(q=>{
      const row=document.createElement("div");row.className="quiz-row";
      row.innerHTML=`<div><h3>${escapeHtml(q.title)}</h3><p>${q.questions.length} questions · Created ${new Date(q.created_at).toLocaleDateString()}</p></div><div class="row-actions"><button class="secondary-btn" data-open="${q.id}">Scores</button><button class="secondary-btn" data-copy="${q.id}">Copy link</button></div>`;
      host.append(row);
    });
    host.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>openQuizDashboard(b.dataset.open)));
    host.querySelectorAll("[data-copy]").forEach(b=>b.addEventListener("click",()=>copyText(makeQuizUrl(b.dataset.copy),b)));
    show("dashboardView");
  }
  function makeQuizUrl(id){const u=new URL(location.href);u.search="";u.hash="";u.searchParams.set("quiz",id);return u.toString();}
  async function copyText(text,button){try{await navigator.clipboard.writeText(text);const old=button.textContent;button.textContent="Copied! ✓";setTimeout(()=>button.textContent=old,1400);}catch{window.prompt("Copy this link:",text);}}
  async function openQuizDashboard(id){
    const {data:quizData,error:qErr}=await supabase.from("quizzes").select("*").eq("id",id).single();
    if(qErr){alert("Could not open this quiz: "+qErr.message);return;}
    if(quizData.owner_id!==user?.id){alert("Only the creator can open this score dashboard.");return;}
    currentQuiz=quizData;
    $("#detailQuizTitle").textContent=quizData.title;$("#detailQuizDescription").textContent=quizData.description||"";
    $("#quizLinkField").value=makeQuizUrl(id);status("detailStatus","");
    const {data:attempts,error}=await supabase.from("quiz_attempts").select("id,score,total,answers,created_at").eq("quiz_id",id).order("created_at",{ascending:false}).limit(100);
    if(error){status("detailStatus","Could not load scores: "+error.message,true);return;}
    const all=attempts||[], plays=all.length, average=plays?Math.round(all.reduce((n,a)=>n+(a.score/a.total),0)/plays*100):0, perfect=all.filter(a=>a.score===a.total).length;
    $("#playsStat").textContent=plays;$("#averageStat").textContent=average+"%";$("#perfectStat").textContent=perfect;
    const qStats=$("#questionStats");qStats.replaceChildren();
    quizData.questions.forEach((q,qi)=>{
      const correct=all.filter(a=>Array.isArray(a.answers)&&Number(a.answers[qi])===Number(q.correct)).length;
      const pct=plays?Math.round(correct/plays*100):0;
      const el=document.createElement("div");el.className="question-stat";
      el.innerHTML=`<div class="question-stat-head"><span>${qi+1}. ${escapeHtml(q.text)}</span><span>${correct}/${plays} (${pct}%)</span></div><div class="stat-track"><div class="stat-fill" style="width:${pct}%"></div></div>`;
      qStats.append(el);
    });
    const attemptHost=$("#attemptsList");attemptHost.replaceChildren();
    if(!all.length)attemptHost.innerHTML='<p class="muted small">No attempts yet. Share your quiz link to get your first score!</p>';
    all.forEach((a,i)=>{const el=document.createElement("div");el.className="attempt-row";el.innerHTML=`<span>Attempt ${plays-i} · ${new Date(a.created_at).toLocaleString()}</span><strong>${a.score}/${a.total} · ${Math.round(a.score/a.total*100)}%</strong>`;attemptHost.append(el);});
    show("detailView");
  }
  $("#copyQuizLink").addEventListener("click",()=>copyText($("#quizLinkField").value,$("#copyQuizLink")));
  $("#deleteQuizBtn").addEventListener("click",async()=>{
    if(!currentQuiz||!confirm(`Delete "${currentQuiz.title}" and all its attempts? This cannot be undone.`))return;
    const {error}=await supabase.from("quizzes").delete().eq("id",currentQuiz.id).eq("owner_id",user.id);
    if(error){status("detailStatus",error.message,true);return;}
    currentQuiz=null;await loadMyQuizzes();
  });
  async function loadPublicQuiz(id){
    if(!requireConfig())return;
    const {data,error}=await supabase.from("quizzes").select("id,title,description,questions").eq("id",id).single();
    if(error||!data){show("takeView");$("#takeTitle").textContent="Quiz not found";$("#takeDescription").textContent="This link may be incorrect or the quiz may have been removed.";$("#takeQuestionArea").replaceChildren();return;}
    currentQuiz=data;takeQuestionIndex=0;takeAnswers=Array(data.questions.length).fill(null);
    renderTakeQuestion();show("takeView");
  }
  function renderTakeQuestion(){
    const q=currentQuiz.questions[takeQuestionIndex], n=currentQuiz.questions.length;
    $("#takeTitle").textContent=currentQuiz.title;$("#takeDescription").textContent=currentQuiz.description||"Choose the answer that feels right.";
    $("#takeProgress").textContent=`Question ${takeQuestionIndex+1} of ${n}`;$("#takeProgressFill").style.width=((takeQuestionIndex+1)/n*100)+"%";
    $("#takeEyebrow").textContent="QUESTION "+(takeQuestionIndex+1);
    const area=$("#takeQuestionArea");area.replaceChildren();
    const title=document.createElement("div");title.className="take-question";title.textContent=q.text;area.append(title);
    const options=document.createElement("div");options.className="take-options";
    q.options.forEach((opt,oi)=>{const b=document.createElement("button");b.type="button";b.className="take-option"+(takeAnswers[takeQuestionIndex]===oi?" selected":"");b.setAttribute("aria-pressed",takeAnswers[takeQuestionIndex]===oi?"true":"false");b.innerHTML=`<span class="option-letter">${String.fromCharCode(65+oi)}</span><span>${escapeHtml(opt)}</span>`;b.addEventListener("click",()=>{takeAnswers[takeQuestionIndex]=oi;renderTakeQuestion();});options.append(b);});
    area.append(options);
    const nav=document.createElement("div");nav.className="take-nav";
    const prev=document.createElement("button");prev.className="secondary-btn";prev.textContent="← Back";prev.disabled=takeQuestionIndex===0;prev.addEventListener("click",()=>{takeQuestionIndex--;renderTakeQuestion();});
    const next=document.createElement("button");next.className="primary-btn";next.textContent=takeQuestionIndex===n-1?"Finish quiz ✓":"Next →";next.addEventListener("click",submitOrNext);
    nav.append(prev,next);area.append(nav);status("takeStatus","");
  }
  async function submitOrNext(){
    if(takeAnswers[takeQuestionIndex]===null){status("takeStatus","Choose an answer to continue.",true);return;}
    if(takeQuestionIndex<currentQuiz.questions.length-1){takeQuestionIndex++;renderTakeQuestion();return;}
    const score=currentQuiz.questions.reduce((sum,q,i)=>sum+(Number(takeAnswers[i])===Number(q.correct)?1:0),0),total=currentQuiz.questions.length;
    $("#scoreHeading").textContent=currentQuiz.title;$("#scoreFraction").textContent=`${score}/${total}`;$("#scorePercent").textContent=Math.round(score/total*100)+"%";
    $("#scoreMessage").textContent=score===total?"Perfect score! You know your stuff. ✨":score>=Math.ceil(total*.7)?"Nice work! You got most of them right. ♡":"Thanks for playing! Try again or share it with a friend.";
    lastScoreText=`I scored ${score}/${total} (${Math.round(score/total*100)}%) on “${currentQuiz.title}” on PinkPop!`;
    show("scoreView");
    // The public key is safe to expose; RLS lets visitors submit attempts but not read them.
    const {error}=await supabase.from("quiz_attempts").insert({quiz_id:currentQuiz.id,score,total,answers:takeAnswers});
    if(error)$("#scoreMessage").textContent+=` Your score is shown here, but could not be saved: ${error.message}`;
  }
  $("#shareScoreBtn").addEventListener("click",async()=>{
    try{if(navigator.share)await navigator.share({title:"My PinkPop quiz score",text:lastScoreText,url:location.href});else{await navigator.clipboard.writeText(lastScoreText+" "+location.href);alert("Score copied!");}}catch(e){if(e.name!=="AbortError")window.prompt("Copy your score:",lastScoreText+" "+location.href);}
  });
  $("#homeScoreBtn").addEventListener("click",()=>{history.replaceState({},"",location.pathname);currentQuiz=null;show(user?"dashboardView":"homeView");});
  init();
})();