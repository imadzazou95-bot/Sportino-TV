const CONFIG = window.KORA_CONFIG || {};

const $ = selector => document.querySelector(selector);


/* ================= THEME ================= */

function initTheme() {

    const saved =
        localStorage.getItem("kora_theme") ||
        "dark";

    document.documentElement.setAttribute(
        "data-theme",
        saved
    );

    const btn = $("#themeBtn");

    if (!btn)
        return;

    btn.textContent =
        saved === "light" ? "☀" : "☾";

    btn.onclick = () => {

        const current =
            document.documentElement.getAttribute(
                "data-theme"
            ) === "light" ? "light" : "dark";

        const next =
            current === "light" ? "dark" : "light";

        document.documentElement.setAttribute(
            "data-theme",
            next
        );

        localStorage.setItem(
            "kora_theme",
            next
        );

        btn.textContent =
            next === "light" ? "☀" : "☾";
    };
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char]));
}

function getDate(offset = 0) {

    const date = new Date();

    date.setDate(date.getDate() + offset);

    return date.toISOString().slice(0, 10);
}


/* ================= API ================= */

async function API(path) {

    if (
        !CONFIG.API_KEY ||
        CONFIG.API_KEY.startsWith("PUT_")
    ) {
        throw new Error(
            "ضع API Key داخل ملف config.js"
        );
    }

    const response = await fetch(
        CONFIG.API_BASE + path,
        {
            headers: {
                "x-apisports-key":
                    CONFIG.API_KEY
            }
        }
    );

    if (!response.ok) {
        throw new Error(
            "خطأ API: " +
            response.status
        );
    }

    const data = await response.json();

    if (
        data.errors &&
        Object.keys(data.errors).length
    ) {
        throw new Error(
            JSON.stringify(data.errors)
        );
    }

    return data.response || [];
}


/* ================= STATUS ================= */

function matchStatus(status) {

    const liveStatuses = [
        "1H",
        "2H",
        "ET",
        "P",
        "LIVE"
    ];

    const names = {

        NS: "لم تبدأ",

        HT: "استراحة",

        FT: "انتهت",

        AET: "بعد الوقت الإضافي",

        PEN: "ركلات ترجيح",

        CANC: "ملغاة",

        PST: "مؤجلة"
    };

    return {

        live:
            liveStatuses.includes(status),

        text:
            names[status] ||
            status ||
            ""
    };
}


/* ================= MATCH CARD ================= */

function createMatchCard(match) {

    const home =
        match.teams?.home || {};

    const away =
        match.teams?.away || {};

    const goals =
        match.goals || {};

    const status =
        matchStatus(
            match.fixture?.status?.short
        );

    let score;

    if (
        goals.home == null &&
        goals.away == null
    ) {

        score =
            match.fixture?.date
                ?.slice(11, 16);

    } else {

        score =
            `${goals.home} - ${goals.away}`;
    }

    return `

    <div
        class="match"
        onclick="
        location.href='match.html?id=${match.fixture.id}'
        "
    >

        <div class="team">

            <img
                src="${escapeHTML(home.logo || "")}"
                onerror="
                this.style.display='none'
                "
            >

            <div>
                ${escapeHTML(home.name)}
            </div>

        </div>


        <div>

            <div class="score">
                ${score}
            </div>

            <span
                class="
                status
                ${status.live ? "live" : ""}
                "
            >
                ${escapeHTML(status.text)}
            </span>

        </div>


        <div class="team">

            <img
                src="${escapeHTML(away.logo || "")}"
                onerror="
                this.style.display='none'
                "
            >

            <div>
                ${escapeHTML(away.name)}
            </div>

        </div>

    </div>

    `;
}


/* ================= LOAD MATCHES ================= */

async function loadMatches(day = 0) {

    const box =
        $("#matchesBox");

    if (!box)
        return;

    box.innerHTML = `
        <div class="loading">
            جاري تحميل المباريات...
        </div>
    `;

    try {

        let matches = [];

        for (
            const league
            of (CONFIG.DEFAULT_LEAGUES || [])
        ) {

            try {

                const result =
                    await API(
                        `/fixtures?league=${league}` +
                        `&season=${new Date().getFullYear()}` +
                        `&date=${getDate(day)}`
                    );

                matches.push(...result);

            } catch (error) {

                console.log(error);
            }
        }


        matches.sort(
            (a, b) =>
                new Date(a.fixture.date) -
                new Date(b.fixture.date)
        );


        const search =
            ($("#search")?.value || "")
                .trim()
                .toLowerCase();


        if (search) {

            matches =
                matches.filter(match => {

                    const text =
                        `
                        ${match.teams.home.name}
                        ${match.teams.away.name}
                        ${match.league.name}
                        `.toLowerCase();

                    return text.includes(search);
                });
        }


        const groups = {};

        matches.forEach(match => {

            const id =
                match.league.id;

            if (!groups[id])
                groups[id] = [];

            groups[id].push(match);

        });


        if (!matches.length) {

            box.innerHTML = `
                <div class="loading">
                    لا توجد مباريات.
                </div>
            `;

            if ($("#matchCount"))
                $("#matchCount").textContent =
                    "0";

            return;
        }


        box.innerHTML =
            Object.values(groups)
                .map(group => {

                    return `

                    <div class="league">

                        <div class="league-title">

                            <img
                                src="${escapeHTML(
                                    group[0].league.logo
                                )}"
                            >

                            <span>
                                ${escapeHTML(
                                    group[0].league.name
                                )}
                            </span>

                        </div>

                        ${group
                            .map(createMatchCard)
                            .join("")}

                    </div>

                    `;
                })
                .join("");


        if ($("#matchCount"))
            $("#matchCount").textContent =
                matches.length;


    } catch (error) {

        box.innerHTML = `

            <div class="loading">

                ${escapeHTML(
                    error.message
                )}

            </div>

        `;
    }
}


/* ================= MATCH DETAILS ================= */

async function loadMatchDetails() {

    const box =
        $("#matchDetail");

    if (!box)
        return;


    const id =
        new URLSearchParams(
            location.search
        ).get("id");


    if (!id) {

        box.textContent =
            "رقم المباراة غير موجود";

        return;
    }


    try {

        const result =
            await API(
                `/fixtures?id=${id}`
            );


        const match =
            result[0];


        if (!match) {

            box.textContent =
                "المباراة غير موجودة";

            return;
        }


        const status =
            matchStatus(
                match.fixture.status.short
            );


        const goals =
            match.goals || {};


        box.innerHTML = `

        <div class="detail-head">

            <img
                src="${escapeHTML(
                    match.league.logo
                )}"
            >

            <h1>
                ${escapeHTML(
                    match.league.name
                )}
            </h1>

            <span class="muted">
                ${escapeHTML(
                    match.fixture.venue?.name ||
                    ""
                )}
            </span>

        </div>


        <div class="detail-teams">

            <div class="detail-team">

                <img
                    src="${escapeHTML(
                        match.teams.home.logo
                    )}"
                >

                <h2>
                    ${escapeHTML(
                        match.teams.home.name
                    )}
                </h2>

            </div>


            <div>

                <div class="big-score">

                    ${goals.home ?? "-"}
                    -
                    ${goals.away ?? "-"}

                </div>

                <span
                    class="
                    status
                    ${status.live ? "live" : ""}
                    "
                >
                    ${escapeHTML(
                        status.text
                    )}
                </span>

            </div>


            <div class="detail-team">

                <img
                    src="${escapeHTML(
                        match.teams.away.logo
                    )}"
                >

                <h2>
                    ${escapeHTML(
                        match.teams.away.name
                    )}
                </h2>

            </div>

        </div>

        <h2>
            أحداث المباراة
        </h2>

        <div id="events">
            جاري تحميل الأحداث...
        </div>

        `;


        loadEvents(id);


    } catch (error) {

        box.innerHTML = `

            <div class="loading">

                ${escapeHTML(
                    error.message
                )}

            </div>

        `;
    }
}


/* ================= EVENTS ================= */

async function loadEvents(id) {

    const box =
        $("#events");

    if (!box)
        return;


    try {

        const data =
            await API(
                `/fixtures?id=${id}&events=true`
            );


        const events =
            data[0]?.events || [];


        if (!events.length) {

            box.innerHTML = `
                <p class="muted">
                    لا توجد أحداث متاحة.
                </p>
            `;

            return;
        }


        box.innerHTML =
            events
                .map(event => `

                    <div class="event">

                        ⚽

                        ${escapeHTML(
                            event.time?.elapsed || ""
                        )}'

                        —

                        ${escapeHTML(
                            event.team?.name
                        )}

                        :

                        ${escapeHTML(
                            event.player?.name ||
                            event.type
                        )}

                    </div>

                `)
                .join("");


    } catch {

        box.innerHTML = `
            <p class="muted">
                لا يمكن تحميل الأحداث.
            </p>
        `;
    }
}


/* ================= LEAGUES ================= */

async function loadLeagues() {

    const box =
        $("#leaguesBox");

    if (!box)
        return;


    try {

        let leagues =
            await API(
                "/leagues?current=true"
            );

        const search =
            ($("#leagueSearch")?.value || "")
                .trim()
                .toLowerCase();

        if (search) {

            leagues =
                leagues.filter(item => {

                    const text =
                        `
                        ${item.league.name}
                        ${item.country?.name || ""}
                        `.toLowerCase();

                    return text.includes(search);
                });
        }

        if (!leagues.length) {

            box.innerHTML = `
                <div class="loading">
                    لا توجد بطولات مطابقة.
                </div>
            `;

            return;
        }

        box.innerHTML =
            leagues
                .slice(0, 60)
                .map(item => `

                    <div class="league-card">

                        <img
                            src="${escapeHTML(
                                item.league.logo
                            )}"
                        >

                        <h3>
                            ${escapeHTML(
                                item.league.name
                            )}
                        </h3>

                        <span class="muted">

                            ${escapeHTML(
                                item.country?.name ||
                                ""
                            )}

                        </span>

                    </div>

                `)
                .join("");


    } catch (error) {

        box.innerHTML = `

            <div class="loading">

                ${escapeHTML(
                    error.message
                )}

            </div>

        `;
    }
}


/* ================= LOCAL STORAGE ================= */

const Storage = {

    get(key, fallback = []) {

        try {

            return JSON.parse(
                localStorage.getItem(key)
            ) ?? fallback;

        } catch {

            return fallback;
        }
    },


    set(key, value) {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );
    }

};


/* ================= NEWS ================= */

function loadNews() {

    const box =
        $("#newsBox");

    if (!box)
        return;


    const news =
        Storage.get(
            "kora_news",
            [
                {
                    title:
                        "أخبار كرة القدم اليوم",

                    text:
                        "يمكنك إضافة الأخبار من لوحة التحكم.",

                    image:
                        "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80"
                }
            ]
        );


    box.innerHTML =
        news.map(item => `

            <article class="news-card">

                <img
                    src="${escapeHTML(
                        item.image
                    )}"
                >

                <h3>
                    ${escapeHTML(
                        item.title
                    )}
                </h3>

                <p>
                    ${escapeHTML(
                        item.text
                    )}
                </p>

            </article>

        `).join("");
}


/* ================= ADMIN ================= */

function initializeAdmin() {

    const login =
        $("#login");

    if (!login)
        return;


    $("#loginBtn").onclick = () => {

        const password =
            $("#adminPass").value;


        if (password === "1234") {

            login.classList.add(
                "hidden"
            );

            $("#dashboard")
                .classList.remove(
                    "hidden"
                );

            renderAdmin();

        } else {

            alert(
                "كلمة المرور التجريبية: 1234"
            );
        }

    };


    if ($("#logoutBtn")) {

        $("#logoutBtn").onclick = () => {

            $("#dashboard").classList.add(
                "hidden"
            );

            login.classList.remove(
                "hidden"
            );

            $("#adminPass").value = "";
        };
    }


    $("#saveNews").onclick = () => {

        const title =
            $("#newsTitle").value.trim();

        const text =
            $("#newsText").value.trim();

        if (!title || !text) {

            alert(
                "الرجاء إدخال العنوان والنص"
            );

            return;
        }

        const news =
            Storage.get(
                "kora_news"
            );


        news.unshift({

            title,

            image:
                $("#newsImage").value.trim(),

            text

        });


        Storage.set(
            "kora_news",
            news
        );


        $("#newsTitle").value = "";
        $("#newsImage").value = "";
        $("#newsText").value = "";


        renderAdmin();

        loadNews();

    };


    $("#saveAd").onclick = () => {

        const title =
            $("#adTitle").value.trim();

        if (!title) {

            alert(
                "الرجاء إدخال عنوان الإعلان"
            );

            return;
        }

        const ads =
            Storage.get(
                "kora_ads"
            );


        ads.unshift({

            title,

            url:
                $("#adUrl").value.trim()

        });


        Storage.set(
            "kora_ads",
            ads
        );


        $("#adTitle").value = "";
        $("#adUrl").value = "";


        renderAdmin();

    };


    document
        .querySelectorAll(".tab")
        .forEach(tab => {

            tab.onclick = () => {

                document
                    .querySelectorAll(
                        ".tab"
                    )
                    .forEach(
                        t =>
                            t.classList.remove(
                                "active"
                            )
                    );


                tab.classList.add(
                    "active"
                );


                document
                    .querySelectorAll(
                        "#newsAdmin,#adsAdmin"
                    )
                    .forEach(
                        x =>
                            x.classList.add(
                                "hidden"
                            )
                    );


                $(
                    "#" +
                    tab.dataset.tab
                ).classList.remove(
                    "hidden"
                );

            };

        });

}


/* ================= ADMIN LIST ================= */

function renderAdmin() {

    const news =
        $("#adminNewsList");

    if (news) {

        const items =
            Storage.get(
                "kora_news"
            );


        if (!items.length) {

            news.innerHTML = `
                <p class="empty-note">
                    لا توجد أخبار مضافة بعد.
                </p>
            `;
        }

        else news.innerHTML =
            items.map(
                (item, index) => `

                <div class="admin-item">

                    ${escapeHTML(
                        item.title
                    )}

                    <button
                        class="danger"
                        onclick="
                        deleteItem(
                            'kora_news',
                            ${index}
                        )
                        "
                    >
                        حذف
                    </button>

                </div>

                `
            ).join("");
    }


    const ads =
        $("#adminAdList");

    if (ads) {

        const items =
            Storage.get(
                "kora_ads"
            );


        if (!items.length) {

            ads.innerHTML = `
                <p class="empty-note">
                    لا توجد إعلانات مضافة بعد.
                </p>
            `;
        }

        else ads.innerHTML =
            items.map(
                (item, index) => `

                <div class="admin-item">

                    ${escapeHTML(
                        item.title
                    )}

                    <button
                        class="danger"
                        onclick="
                        deleteItem(
                            'kora_ads',
                            ${index}
                        )
                        "
                    >
                        حذف
                    </button>

                </div>

                `
            ).join("");
    }
}


/* ================= DELETE ================= */

function deleteItem(
    key,
    index
) {

    const items =
        Storage.get(key);

    items.splice(
        index,
        1
    );

    Storage.set(
        key,
        items
    );

    renderAdmin();

    loadNews();
}


/* ================= START ================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initTheme();

        if ($("#matchesBox")) {

            loadMatches(0);


            document
                .querySelectorAll(".day")
                .forEach(button => {

                    button.onclick = () => {

                        document
                            .querySelectorAll(
                                ".day"
                            )
                            .forEach(
                                b =>
                                    b.classList.remove(
                                        "active"
                                    )
                            );


                        button.classList.add(
                            "active"
                        );


                        loadMatches(
                            Number(
                                button.dataset.day
                            )
                        );

                    };

                });


            $("#refresh").onclick =
                () => {

                    const active =
                        document.querySelector(
                            ".day.active"
                        );


                    loadMatches(
                        Number(
                            active?.dataset.day ||
                            0
                        )
                    );

                };


            $("#search").oninput =
                () => {

                    const active =
                        document.querySelector(
                            ".day.active"
                        );


                    loadMatches(
                        Number(
                            active?.dataset.day ||
                            0
                        )
                    );

                };


            loadNews();
        }


        loadMatchDetails();

        loadLeagues();

        initializeAdmin();

        if ($("#leagueSearch")) {

            $("#leagueSearch").oninput =
                () => loadLeagues();
        }

    }
);
