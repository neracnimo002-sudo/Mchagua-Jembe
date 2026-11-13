// FARMFRIEND DATABASE CONNECTION

let farmDatabase = {
    locations: [],
    soils: [],
    crops: [],
    cropSuitability: [],
    fertilizers: []
};

// Load all JSON databases
async function loadFarmDatabase() {
    try {
        const [
            locations,
            soils,
            crops,
            cropSuitability,
            fertilizers
        ] = await Promise.all([
            fetch("./location.json").then(response => {
                if (!response.ok) throw new Error("location.json not found");
                return response.json();
            }),

            fetch("./soil.json").then(response => {
                if (!response.ok) throw new Error("soil.json not found");
                return response.json();
            }),

            fetch("./crops.json").then(response => {
                if (!response.ok) throw new Error("crops.json not found");
                return response.json();
            }),

            fetch("./crop-soil-suitability.json").then(response => {
                if (!response.ok) throw new Error("crop-soil-suitability.json not found");
                return response.json();
            }),

            fetch("./fertilizers.json").then(response => {
                if (!response.ok) throw new Error("fertilizers.json not found");
                return response.json();
            })
        ]);

        farmDatabase = {
            locations,
            soils,
            crops,
            cropSuitability,
            fertilizers
        };

        console.log("FarmFriend databases loaded successfully!");
        console.log(farmDatabase);

        return true;

    } catch (error) {
        console.error("Database loading failed:", error);
        throw error;
    }
}
console.log("FarmFriend JavaScript is connected!");


let displayedCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function getCropById(cropId) {
    return farmDatabase.crops?.crops?.find(crop => crop.crop_id === cropId);
}

function getCropTitle(crop) {
    return crop.names.english || crop.crop_id;
}

function getCalendarStartDate() {
    const dateValue = document.getElementById("calendarStartDate")?.value;
    if (!dateValue) return new Date();

    const [year, month, day] = dateValue.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function getCropActivities(cropId, startDate) {
    const crop = getCropById(cropId);
    const activities = crop?.calendar?.activity_plan || [];

    return activities.map(item => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + item.day);
        return { ...item, date };
    });
}

function formatCalendarDate(date, options = { month: "short", day: "numeric" }) {
    return date.toLocaleDateString(undefined, options);
}

function formatLocalDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function populateDatabaseSelects() {
    const cropSelect = document.getElementById("crop");

    cropSelect.innerHTML = `<option value="">-- Select a crop --</option>` +
        farmDatabase.crops.crops.map(crop =>
            `<option value="${escapeHistoryText(crop.crop_id)}">${escapeHistoryText(getCropTitle(crop))}</option>`
        ).join("");

    const countySelect = document.getElementById("countySelect");
    const locationSuggestions = document.getElementById("locationSuggestions");
    const counties = farmDatabase.locations.counties || [];

    if (countySelect) {
        countySelect.innerHTML = `<option value="">Choose a county</option>` +
            counties.map(county =>
                `<option value="${escapeHistoryText(county.county_name)}">${escapeHistoryText(county.county_name)}</option>`
            ).join("");
    }

    if (locationSuggestions) {
        locationSuggestions.innerHTML = counties.map(county =>
            `<option value="${escapeHistoryText(county.county_name)}"></option>`
        ).join("");
    }

    renderCropGuide();
    renderPopularCrops();
    renderSoilGuide();
}

function normalizePlaceName(name) {
    return String(name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+county$/, "")
        .replace(/[^a-z0-9]/g, "");
}

function getCountySoilProfileByName(countyName) {
    const normalizedName = normalizePlaceName(countyName);
    if (!normalizedName) return null;

    return farmDatabase.soils.counties.find(county =>
        normalizePlaceName(county.county_name) === normalizedName
    ) || null;
}

function renderCropGuide() {
    const cropGuideList = document.getElementById("cropGuideList");
    if (!cropGuideList) return;

    cropGuideList.innerHTML = farmDatabase.crops.crops.map(crop => {
        const harvestDays = crop.days_to_harvest;
        const harvestText = harvestDays
            ? `${harvestDays.min}–${harvestDays.max} days to harvest`
            : "Growing information available";

        return `
            <article class="crop-guide-card">
                <div class="crop-guide-card-top">
                    <h3>${escapeHistoryText(getCropTitle(crop))}</h3>
                    <span class="crop-category">${escapeHistoryText(crop.category || "crop")}</span>
                </div>
                <p>${escapeHistoryText(harvestText)}</p>
                <button type="button" class="crop-guide-select" data-crop-id="${escapeHistoryText(crop.crop_id)}">
                    Use this crop <span aria-hidden="true">→</span>
                </button>
            </article>
        `;
    }).join("");
}

function renderPopularCrops() {
    const popularCrops = document.getElementById("popularCrops");
    if (!popularCrops || !farmDatabase.crops.crops.length) return;

    const counts = new Map();
    getSearchHistory().forEach(item => {
        if (typeof item.crop === "string") {
            counts.set(item.crop, (counts.get(item.crop) || 0) + 1);
        }
    });

    const mostSearched = [...counts.entries()]
        .sort((first, second) => second[1] - first[1])
        .map(([cropId]) => getCropById(cropId))
        .filter(Boolean)
        .slice(0, 4);

    if (!mostSearched.length) {
        popularCrops.innerHTML = `<p class="empty-note">Your search history will help surface the crops you explore most.</p>`;
        return;
    }

    popularCrops.innerHTML = mostSearched.map(crop => `
        <a class="popular-crop" href="#get-started" data-popular-crop="${escapeHistoryText(crop.crop_id)}">
            <span aria-hidden="true">🌱</span>
            ${escapeHistoryText(getCropTitle(crop))}
            <small>${counts.get(crop.crop_id)} searches</small>
        </a>
    `).join("");
}

function renderSoilGuide() {
    const soilGuideContent = document.getElementById("soilGuideContent");
    const countySelect = document.getElementById("countySelect");
    if (!soilGuideContent || !countySelect) return;

    const profile = getCountySoilProfileByName(countySelect.value);
    if (!profile) {
        soilGuideContent.innerHTML = `
            <div class="guide-placeholder">
                <span class="tool-icon icon-earth" aria-hidden="true">◉</span>
                <h3>Start with your location</h3>
                <p>Choose a county in the recommendation search to see its soil profile here.</p>
            </div>
        `;
        return;
    }

    const soilRecords = (profile.soils || [])
        .map(entry => farmDatabase.soils.soil_types.find(soil => soil.soil_id === entry.soil_id))
        .filter(Boolean);
    const textures = profile.derived_summary?.farmer_texture_classes_dominant || [];
    const managementPointers = [...new Set(
        soilRecords.flatMap(soil => soil.farming?.management_pointers || [])
    )].slice(0, 3);

    soilGuideContent.innerHTML = `
        <span class="section-kicker">County profile</span>
        <h3>${escapeHistoryText(profile.county_name)} soils</h3>
        ${textures.length
            ? `<div class="soil-tag-list">${textures.map(texture => `<span class="soil-tag">${escapeHistoryText(texture)} soil</span>`).join("")}</div>`
            : `<p>Dominant soil texture information is not available in the database.</p>`}
        ${profile.local_notes ? `<p>${escapeHistoryText(profile.local_notes)}</p>` : ""}
        ${managementPointers.length
            ? `<ul>${managementPointers.map(pointer => `<li>${escapeHistoryText(pointer)}</li>`).join("")}</ul>`
            : `<p>No county-specific management pointers are available in the soil database.</p>`}
        <p><strong>Remember:</strong> This is a county-level estimate. Soil varies between fields; confirm local conditions with a soil test or an agricultural extension officer.</p>
    `;
}

function getCountySoilProfile(location) {
    const isKenya = location.country_code?.toUpperCase() === "KE" ||
        location.country?.toLowerCase() === "kenya";
    if (!isKenya) return null;

    const placeNames = [location.admin1, location.admin2, location.admin3, location.name]
        .map(normalizePlaceName)
        .filter(Boolean);

    return farmDatabase.soils.counties.find(county =>
        placeNames.includes(normalizePlaceName(county.county_name))
    ) || null;
}

function getSoilGuidanceHTML(countyProfile, crop) {
    if (!countyProfile) {
        return `
            <p><strong>Estimated soil type:</strong> Not available for this location.</p>
            <p>Soil can vary within a county. Use a local soil test or ask an agricultural extension officer for field-specific advice.</p>
            <p><strong>Crop water needs:</strong> ${escapeHistoryText(crop.farmer_guidance.water)}</p>
        `;
    }

    const textureClasses = countyProfile.derived_summary?.farmer_texture_classes_dominant || [];
    const soilRecords = (countyProfile.soils || [])
        .map(profile => farmDatabase.soils.soil_types.find(soil => soil.soil_id === profile.soil_id))
        .filter(Boolean);
    const managementPointers = [...new Set(
        soilRecords.flatMap(soil => soil.farming?.management_pointers || [])
    )].slice(0, 3);

    return `
        <p><strong>Estimated soil type near ${escapeHistoryText(countyProfile.county_name)}:</strong>
            ${textureClasses.length
                ? textureClasses.map(texture => `${escapeHistoryText(texture)} soil`).join(", ")
                : "Not available in the soil database."}
        </p>
        ${countyProfile.local_notes ? `<p>${escapeHistoryText(countyProfile.local_notes)}</p>` : ""}
        ${managementPointers.length
            ? `<ul>${managementPointers.map(pointer => `<li>${escapeHistoryText(pointer)}</li>`).join("")}</ul>`
            : "<p>No soil management guidance is available for this county in the database.</p>"}
        <p>This is a broad county-level estimate, not a measurement of your field. Soil varies locally; confirm it with a soil test or local agricultural advice.</p>
        <p><strong>Crop water needs:</strong> ${escapeHistoryText(crop.farmer_guidance.water)}</p>
    `;
}

function renderCropCalendar() {
    const calendar = document.getElementById("cropCalendar");
    const monthLabel = document.getElementById("calendarMonthLabel");
    const description = document.getElementById("calendarCropDescription");
    const upcomingActivities = document.getElementById("upcomingActivities");
    const crop = document.getElementById("crop").value;

    if (!calendar || !monthLabel || !description || !upcomingActivities) return;

    monthLabel.textContent = displayedCalendarMonth.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric"
    });

    if (!crop) {
        description.textContent = "Select a crop to generate its activity calendar.";
        calendar.innerHTML = `<p class="calendar-empty">Choose a crop above to see its suggested activities.</p>`;
        upcomingActivities.innerHTML = "";
        return;
    }

    const selectedCrop = getCropById(crop);
    if (!selectedCrop) return;

    const cropName = getCropTitle(selectedCrop);
    const startDate = getCalendarStartDate();
    const activities = getCropActivities(crop, startDate);
    if (activities.length === 0) {
        const calendarNote = selectedCrop.calendar?.basis || "No activity plan is available for this crop.";
        description.textContent = `${cropName}: ${calendarNote}`;
        calendar.innerHTML = `<p class="calendar-empty">${escapeHistoryText(calendarNote)}</p>`;
        upcomingActivities.innerHTML = "";
        return;
    }

    description.textContent = `${cropName} activities starting ${formatCalendarDate(startDate, {
        year: "numeric",
        month: "long",
        day: "numeric"
    })}`;

    const activitiesByDate = new Map();
    activities.forEach(activity => {
        const dateKey = activity.date.toDateString();
        const dailyActivities = activitiesByDate.get(dateKey) || [];
        dailyActivities.push(activity);
        activitiesByDate.set(dateKey, dailyActivities);
    });

    const firstDay = new Date(
        displayedCalendarMonth.getFullYear(),
        displayedCalendarMonth.getMonth(),
        1
    );
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));
    const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const cells = weekdayNames.map(day => `<div class="calendar-weekday">${day}</div>`);

    for (let index = 0; index < 42; index += 1) {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        const dayActivities = activitiesByDate.get(date.toDateString()) || [];
        const classes = [
            "calendar-day",
            date.getMonth() !== displayedCalendarMonth.getMonth() ? "is-outside-month" : "",
            date.toDateString() === new Date().toDateString() ? "is-today" : ""
        ].filter(Boolean).join(" ");
        const activityMarkup = dayActivities.map(activity => `
            <span class="calendar-event" title="${activity.stage}: ${activity.activity}">
                ${activity.stage}
            </span>
        `).join("");

        cells.push(`
            <div class="${classes}">
                <span class="calendar-day-number">${date.getDate()}</span>
                ${activityMarkup}
            </div>
        `);
    }

    calendar.innerHTML = cells.join("");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = activities
        .filter(activity => activity.date >= today)
        .slice(0, 3);

    upcomingActivities.innerHTML = upcoming.length
        ? upcoming.map(activity => `
            <article class="upcoming-activity">
                <time datetime="${formatLocalDateValue(activity.date)}">${formatCalendarDate(activity.date)}</time>
                <div>
                    <strong>${activity.stage}</strong>
                    <p>${activity.activity}</p>
                </div>
            </article>
        `).join("")
        : `<p class="calendar-empty">No upcoming activities remain in this schedule. Choose a new schedule start date to generate another plan.</p>`;
}
async function getWeather(latitude, longitude) {

    const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}` +
        `&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,rain` +
        `&daily=temperature_2m_max,temperature_2m_min,rain_sum` +
        `&forecast_days=7` +
        `&timezone=auto`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Unable to retrieve weather data.");
    }

    return await response.json();
}

function analyzeCrop(crop, weather) {
    const currentTemp = weather.current.temperature_2m;
    const temperatureRange = crop.climate.temperature_c;

    const forecastRain = weather.daily.rain_sum.reduce(
        (total, rain) => total + (rain ?? 0),
        0
    );

    // Temperature check
    const temperatureSuitable =
        currentTemp >= temperatureRange.optimal_min &&
        currentTemp <= temperatureRange.optimal_max;

    // Short-term rainfall check.
    // This is a monitoring indicator, not a seasonal suitability test.
    const rainfallSuitable =
        forecastRain >= 10 && forecastRain <= 100;

    let score = 0;

    if (temperatureSuitable) score += 50;
    if (rainfallSuitable) score += 50;

    let recommendation;

    if (score === 100) {
        recommendation = "Both temperature and forecast rainfall indicators are within the prototype's target ranges.";
    } else if (score === 50) {
        recommendation = "One indicator is within the target range. Check the other conditions before planting.";
    } else {
        recommendation = "Current indicators do not both meet the prototype's target ranges. Seek local agricultural advice before deciding.";
    }

    return {
        currentTemp,
        forecastRain,
        temperatureSuitable,
        rainfallSuitable,
        score,
        recommendation
    };
}
async function findLocation(locationName) {

    const url =
        `https://geocoding-api.open-meteo.com/v1/search` +
        `?name=${encodeURIComponent(locationName)}` +
        `&count=1` +
        `&language=en` +
        `&format=json`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Unable to find the location.");
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
        throw new Error("Location not found.");
    }

    return data.results[0];
}
async function getCropInformation() {
    const irrigation = document.getElementById("irrigation").value;
    const countySelect = document.getElementById("countySelect");
    const locationInput = document.getElementById("location").value.trim() ||
        countySelect?.value ||
        "";
    const cropId = document.getElementById("crop").value;
    const result = document.getElementById("result");
    const submitButton = document.getElementById("getCropInformationButton");
    const weatherPanel = document.getElementById("weatherPanel");

    if (locationInput === "" || cropId === "") {
        result.innerHTML = `<p class="form-error">Please enter your location and select a crop.</p>`;
        return;
    }

    if (submitButton) submitButton.disabled = true;
    result.innerHTML = `
        <p class="loading-state"><span class="loading-spinner" aria-hidden="true"></span> Finding your location and preparing recommendations…</p>
    `;
    if (weatherPanel) {
        weatherPanel.innerHTML = `
            <div class="weather-empty"><span aria-hidden="true">☁</span><p>Loading the forecast for your location…</p></div>
        `;
    }

    try {
        const selectedCrop = getCropById(cropId);
        if (!selectedCrop) {
            throw new Error("Crop details are not available in crops.json.");
        }

        const location = await findLocation(locationInput);
        const countySoilProfile = getCountySoilProfile(location) ||
            getCountySoilProfileByName(countySelect?.value || locationInput);
        const weather = await getWeather(location.latitude, location.longitude);
        saveSearchHistory(location.name, cropId);

        const scheduledActivities = getCropActivities(cropId, getCalendarStartDate());
        const calendarActivities = selectedCrop.calendar?.activity_plan || [];
        const analysis = analyzeCrop(selectedCrop, weather);
        const temperatureRange = selectedCrop.climate.temperature_c;
        const rainfallRange = selectedCrop.climate.rainfall_mm_per_year;
        const cropTitle = getCropTitle(selectedCrop);
        const altitudeRange = selectedCrop.climate.altitude_m;
        const soilRequirements = selectedCrop.soil || {};
        const cropWater = selectedCrop.water || {};
        const farmerGuidance = selectedCrop.farmer_guidance || {};
        const suitabilityData = farmDatabase.cropSuitability.crops
            .find(item => item.crop_id === cropId);
        const countySoilMatches = countySoilProfile
            ? (countySoilProfile.soils || []).map(countySoil => {
                const soil = farmDatabase.soils.soil_types
                    .find(item => item.soil_id === countySoil.soil_id);
                const suitability = suitabilityData?.soils
                    ?.find(item => item.soil_id === countySoil.soil_id);
                return { countySoil, soil, suitability };
            }).filter(item => item.soil)
            : [];
        const soilRatingText = rating => String(rating || "Not rated")
            .replace(/_/g, " ")
            .replace(/\b\w/g, character => character.toUpperCase());
        const pestTips = (farmerGuidance.tips || [])
            .filter(tip => /pest|disease|fung|insect|monitor/i.test(tip));
        const harvestTips = (farmerGuidance.tips || [])
            .filter(tip => /harvest|matur|dry enough|storage/i.test(tip));
        const harvestActivities = calendarActivities
            .filter(activity => /harvest/i.test(activity.stage || ""));
        const forecastMarkup = weather.daily.time.map((date, index) => {
            const displayDate = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric"
            });
            return `
                <div class="forecast-day">
                    <strong>${escapeHistoryText(displayDate)}</strong>
                    <p>High: ${escapeHistoryText(weather.daily.temperature_2m_max[index])}°C</p>
                    <p>Low: ${escapeHistoryText(weather.daily.temperature_2m_min[index])}°C</p>
                    <p>Rain: ${escapeHistoryText(weather.daily.rain_sum[index])} mm</p>
                </div>
            `;
        }).join("");
        const soilMatchesMarkup = countySoilMatches.length
            ? `
                <p>County-level soil types and their database suitability for ${escapeHistoryText(cropTitle)}:</p>
                <div class="soil-match-list">
                    ${countySoilMatches.map(({ countySoil, soil, suitability }) => `
                        <article class="soil-match">
                            <div class="soil-match-title">
                                <span>${escapeHistoryText(soil.wrb_group || soil.soil_id)}${countySoil.role === "dominant" ? " · dominant" : ""}</span>
                                <span>${escapeHistoryText(soilRatingText(suitability?.rating))}${typeof suitability?.score === "number" ? ` · ${suitability.score}/100` : ""}</span>
                            </div>
                            ${suitability?.limiting_factors?.length
                                ? `<p>${suitability.limiting_factors.map(escapeHistoryText).join("; ")}</p>`
                                : ""}
                            ${suitability?.management?.length
                                ? `<ul>${suitability.management.map(item => `<li>${escapeHistoryText(item)}</li>`).join("")}</ul>`
                                : ""}
                        </article>
                    `).join("")}
                </div>
            `
            : `<p>County-specific soil suitability is not available for this location in the soil database. Use the crop requirements below as a guide and confirm your field conditions locally.</p>`;
        const plantingActivitiesMarkup = scheduledActivities.length
            ? scheduledActivities.map(item => `
                <div class="calendar-item">
                    <time datetime="${formatLocalDateValue(item.date)}">${formatCalendarDate(item.date)}</time>
                    <div><h4>${escapeHistoryText(item.stage)}</h4><p>${escapeHistoryText(item.activity)}</p></div>
                </div>
            `).join("")
            : `<p>${escapeHistoryText(selectedCrop.calendar?.basis || "No activity plan is available for this crop.")}</p>`;
        const climateSuitabilityMarkup = `
            <div class="suitability">
                <p><strong>Preliminary indicator score:</strong> ${analysis.score}/100</p>
                <p><strong>Current temperature:</strong> ${escapeHistoryText(weather.current.temperature_2m)}°C — ${analysis.temperatureSuitable ? "within" : "outside"} the crop's optimal range</p>
                <p><strong>Seven-day rainfall:</strong> ${analysis.forecastRain.toFixed(1)} mm — ${analysis.rainfallSuitable ? "within" : "outside"} the prototype's target range</p>
                <p>${escapeHistoryText(analysis.recommendation)}</p>
            </div>
        `;

        result.innerHTML = `
            <div class="recommendation-results">
                <div class="results-header">
                    <div>
                        <span class="section-kicker">Your farming guidance</span>
                        <h2>${escapeHistoryText(cropTitle)} recommendations</h2>
                        <p>${escapeHistoryText(location.name)}, ${escapeHistoryText(location.country)} · Planning from ${formatCalendarDate(getCalendarStartDate(), { year: "numeric", month: "long", day: "numeric" })}</p>
                    </div>
                    <span class="results-badge">Based on available data</span>
                </div>
                <div class="results-details">
                    <details class="result-section" open>
                        <summary>Crop overview</summary>
                        <div class="result-section-content">
                            <p><strong>Category:</strong> ${escapeHistoryText(selectedCrop.category || "Not specified")}</p>
                            <p><strong>Life cycle:</strong> ${escapeHistoryText(selectedCrop.life_cycle || "Not specified")}</p>
                            ${selectedCrop.names.swahili ? `<p><strong>Swahili name:</strong> ${escapeHistoryText(selectedCrop.names.swahili)}</p>` : ""}
                            ${selectedCrop.names.scientific ? `<p><strong>Scientific name:</strong> <em>${escapeHistoryText(selectedCrop.names.scientific)}</em></p>` : ""}
                            ${(selectedCrop.kenya_notes || []).length
                                ? `<ul>${selectedCrop.kenya_notes.map(note => `<li>${escapeHistoryText(note)}</li>`).join("")}</ul>`
                                : ""}
                        </div>
                    </details>
                    <details class="result-section">
                        <summary>Recommended growing conditions</summary>
                        <div class="result-section-content">
                            <p><strong>Soil guidance:</strong> ${escapeHistoryText(farmerGuidance.soil || "See the soil requirements below.")}</p>
                            ${farmerGuidance.spacing ? `<p><strong>Spacing:</strong> ${escapeHistoryText(farmerGuidance.spacing)}</p>` : ""}
                            ${farmerGuidance.tips?.length
                                ? `<ul>${farmerGuidance.tips.map(tip => `<li>${escapeHistoryText(tip)}</li>`).join("")}</ul>`
                                : ""}
                        </div>
                    </details>
                    <details class="result-section">
                        <summary>Soil requirements and local recommendations</summary>
                        <div class="result-section-content">
                            <p><strong>Preferred pH:</strong> ${soilRequirements.ph?.optimal_min ?? "Not specified"}–${soilRequirements.ph?.optimal_max ?? "Not specified"}</p>
                            <p><strong>Preferred textures:</strong> ${escapeHistoryText((soilRequirements.texture_preferred || []).join(", ") || "Not specified")}</p>
                            <p><strong>Drainage:</strong> ${escapeHistoryText((soilRequirements.drainage_preferred || []).join(", ") || "Not specified")}</p>
                            <p><strong>Soil depth:</strong> ${escapeHistoryText(soilRequirements.min_depth_class || "Not specified")} · <strong>Fertility demand:</strong> ${escapeHistoryText(soilRequirements.fertility_demand || "Not specified")}</p>
                            ${countySoilProfile
                                ? `<p><strong>Location profile:</strong> ${escapeHistoryText(countySoilProfile.county_name)} county</p>${countySoilProfile.local_notes ? `<p>${escapeHistoryText(countySoilProfile.local_notes)}</p>` : ""}`
                                : ""}
                            ${soilMatchesMarkup}
                            <p class="guidance-disclaimer">County-level soil information is an estimate, not a measurement of your field.</p>
                        </div>
                    </details>
                    <details class="result-section">
                        <summary>Climate requirements and suitability</summary>
                        <div class="result-section-content">
                            <p><strong>Optimal temperature:</strong> ${temperatureRange.optimal_min}–${temperatureRange.optimal_max}°C</p>
                            <p><strong>Optimal annual rainfall:</strong> ${rainfallRange.optimal_min}–${rainfallRange.optimal_max} mm</p>
                            ${altitudeRange ? `<p><strong>Suitable altitude:</strong> ${altitudeRange.optimal_min}–${altitudeRange.optimal_max} m</p>` : ""}
                            ${climateSuitabilityMarkup}
                        </div>
                    </details>
                    <details class="result-section">
                        <summary>Planting information</summary>
                        <div class="result-section-content">
                            ${farmerGuidance.spacing ? `<p><strong>Spacing:</strong> ${escapeHistoryText(farmerGuidance.spacing)}</p>` : ""}
                            <p>Suggested activity plan from ${formatCalendarDate(getCalendarStartDate(), { year: "numeric", month: "long", day: "numeric" })}:</p>
                            <div class="calendar-list">${plantingActivitiesMarkup}</div>
                            <p><a href="#cropCalendarSection">Open the monthly crop calendar</a></p>
                        </div>
                    </details>
                    <details class="result-section">
                        <summary>Fertilizer recommendations</summary>
                        <div class="result-section-content">${getFertilizerGuidanceHTML(cropId)}</div>
                    </details>
                    <details class="result-section">
                        <summary>Water requirements</summary>
                        <div class="result-section-content">
                            <p><strong>Water requirement:</strong> ${escapeHistoryText(cropWater.need_class || "Not specified")}</p>
                            <p><strong>Your water availability:</strong> ${escapeHistoryText(irrigation || "Not specified")}</p>
                            ${cropWater.critical_stages?.length ? `<p><strong>Critical growth stages:</strong></p><ul>${cropWater.critical_stages.map(stage => `<li>${escapeHistoryText(stage)}</li>`).join("")}</ul>` : ""}
                            ${cropWater.irrigation_note ? `<p>${escapeHistoryText(cropWater.irrigation_note)}</p>` : ""}
                            ${farmerGuidance.water ? `<p><strong>Farmer guidance:</strong> ${escapeHistoryText(farmerGuidance.water)}</p>` : ""}
                        </div>
                    </details>
                    <details class="result-section">
                        <summary>Pest and disease management</summary>
                        <div class="result-section-content">
                            ${pestTips.length
                                ? `<ul>${pestTips.map(tip => `<li>${escapeHistoryText(tip)}</li>`).join("")}</ul>`
                                : `<p>Specific pest and disease recommendations are not available in the crop database for this crop. Monitor crops regularly and consult a local agricultural extension officer if you notice a problem.</p>`}
                        </div>
                    </details>
                    <details class="result-section">
                        <summary>Harvesting information</summary>
                        <div class="result-section-content">
                            ${selectedCrop.days_to_harvest ? `<p><strong>Typical harvest window:</strong> ${selectedCrop.days_to_harvest.min}–${selectedCrop.days_to_harvest.max} days${selectedCrop.days_to_harvest.note ? ` — ${escapeHistoryText(selectedCrop.days_to_harvest.note)}` : ""}</p>` : `<p>A typical harvest window is not available in the crop database.</p>`}
                            ${harvestTips.length ? `<ul>${harvestTips.map(tip => `<li>${escapeHistoryText(tip)}</li>`).join("")}</ul>` : ""}
                            ${harvestActivities.length ? `<ul>${harvestActivities.map(activity => `<li><strong>${escapeHistoryText(activity.stage)}:</strong> ${escapeHistoryText(activity.activity)}</li>`).join("")}</ul>` : ""}
                        </div>
                    </details>
                    <details class="result-section">
                        <summary>Current weather and 7-day forecast</summary>
                        <div class="result-section-content">
                            <p><strong>Current temperature:</strong> ${escapeHistoryText(weather.current.temperature_2m)}°C · <strong>Rain:</strong> ${escapeHistoryText(weather.current.rain)} mm · <strong>Humidity:</strong> ${escapeHistoryText(weather.current.relative_humidity_2m)}%</p>
                            <div class="forecast">${forecastMarkup}</div>
                        </div>
                    </details>
                </div>
            </div>
        `;

        if (weatherPanel) {
            weatherPanel.innerHTML = `
                <div class="weather-summary">
                    <div>
                        <h3>${escapeHistoryText(location.name)}, ${escapeHistoryText(location.country)}</h3>
                        <p>Current local conditions</p>
                    </div>
                    <div class="weather-current">${escapeHistoryText(weather.current.temperature_2m)}°C <small>${escapeHistoryText(weather.current.relative_humidity_2m)}% humidity</small></div>
                </div>
                <div class="weather-forecast">
                    ${weather.daily.time.map((date, index) => `
                        <div class="weather-day">
                            <strong>${escapeHistoryText(new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" }))}</strong>
                            <span>${escapeHistoryText(weather.daily.temperature_2m_max[index])}° / ${escapeHistoryText(weather.daily.temperature_2m_min[index])}°</span>
                            <small>${escapeHistoryText(weather.daily.rain_sum[index])} mm rain</small>
                        </div>
                    `).join("")}
                </div>
            `;
        }

    } catch (error) {
        console.error("Could not retrieve crop recommendations:", error);
        result.innerHTML = `
            <div class="search-error" role="alert">
                <strong>We couldn’t prepare recommendations.</strong>
                <p>${escapeHistoryText(error.message)}</p>
                <p>Please check your location and connection, then try again.</p>
            </div>
        `;
        if (weatherPanel) {
            weatherPanel.innerHTML = `
                <div class="weather-empty"><span aria-hidden="true">☁</span><p>Weather information is unavailable until a location search succeeds.</p></div>
            `;
        }
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

function getSearchHistory() {
    try {
        return JSON.parse(
            localStorage.getItem("farmGuideHistory") || "[]"
        );
    } catch (error) {
        console.error("Could not read search history:", error);
        return [];
    }
}

function saveSearchHistory(location, crop) {
    const history = getSearchHistory();

    history.unshift({
        location: location,
        crop: crop,
        date: new Date().toLocaleString()
    });

    // Keep the latest 2
    localStorage.setItem(
        "farmGuideHistory",
        JSON.stringify(history.slice(0, 20))
    );

    displaySearchHistory();
}

function displaySearchHistory() {
    const historyList = document.getElementById("historyList");

    if (!historyList) return;

    const history = getSearchHistory();

    if (history.length === 0) {
        historyList.innerHTML = "<p>No searches saved yet.</p>";
        renderPopularCrops();
        return;
    }

    historyList.innerHTML = history.map(item => `
        <div class="history-card">
            <p><strong>Location:</strong> ${escapeHistoryText(
                typeof item.location === "string"
                    ? item.location
                    : item.location?.name || "Unknown location"
            )}</p>
            <p><strong>Crop:</strong> ${escapeHistoryText(item.crop)}</p>
            <p><strong>Date:</strong> ${escapeHistoryText(item.date)}</p>
        </div>
    `).join("");
    renderPopularCrops();
}

function escapeHistoryText(value) {
    const element = document.createElement("span");
    element.textContent = String(value ?? "");
    return element.innerHTML;
}

function clearSearchHistory() {
    if (confirm("Are you sure you want to clear your search history?")) {
        localStorage.removeItem("farmGuideHistory");
        displaySearchHistory();
    }
}

document.addEventListener("DOMContentLoaded", async function () {
    const result = document.getElementById("result");
    const submitButton = document.getElementById("getCropInformationButton");

    try {
        await loadFarmDatabase();
        populateDatabaseSelects();
        if (submitButton) submitButton.disabled = false;
    } catch (error) {
        if (result) {
            result.textContent = `Farm data could not be loaded: ${error.message}`;
        }
        return;
    }

    displaySearchHistory();

    const startDateInput = document.getElementById("calendarStartDate");
    if (startDateInput) {
        startDateInput.value = formatLocalDateValue(new Date());
    }

    const cropSelect = document.getElementById("crop");
    if (cropSelect) {
        cropSelect.addEventListener("change", function () {
            displayedCalendarMonth = new Date(
                getCalendarStartDate().getFullYear(),
                getCalendarStartDate().getMonth(),
                1
            );
            renderCropCalendar();
            renderFertilizerGuidance(cropSelect.value);
        });
        renderFertilizerGuidance(cropSelect.value);
    }

    const countySelect = document.getElementById("countySelect");
    const locationInput = document.getElementById("location");
    if (countySelect && locationInput) {
        countySelect.addEventListener("change", function () {
            if (countySelect.value) {
                locationInput.value = countySelect.value;
            }
            renderSoilGuide();
        });

        locationInput.addEventListener("change", function () {
            const matchingCounty = farmDatabase.locations.counties.find(county =>
                normalizePlaceName(county.county_name) === normalizePlaceName(locationInput.value)
            );
            countySelect.value = matchingCounty?.county_name || "";
            renderSoilGuide();
        });
    }

    const cropGuideList = document.getElementById("cropGuideList");
    if (cropGuideList) {
        cropGuideList.addEventListener("click", function (event) {
            const button = event.target.closest("[data-crop-id]");
            if (!button || !cropSelect) return;

            cropSelect.value = button.dataset.cropId;
            cropSelect.dispatchEvent(new Event("change"));
            document.getElementById("get-started").scrollIntoView({ behavior: "smooth" });
        });
    }

    const popularCrops = document.getElementById("popularCrops");
    if (popularCrops) {
        popularCrops.addEventListener("click", function (event) {
            const link = event.target.closest("[data-popular-crop]");
            if (!link || !cropSelect) return;

            cropSelect.value = link.dataset.popularCrop;
            cropSelect.dispatchEvent(new Event("change"));
        });
    }

    const mobileNav = document.querySelector(".mobile-nav");
    if (mobileNav) {
        mobileNav.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", function () {
                mobileNav.open = false;
            });
        });
    }

    if (startDateInput) {
        startDateInput.addEventListener("change", function () {
            const startDate = getCalendarStartDate();
            displayedCalendarMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
            renderCropCalendar();
        });
    }

    const previousMonthButton = document.getElementById("previousCalendarMonth");
    if (previousMonthButton) {
        previousMonthButton.addEventListener("click", function () {
            displayedCalendarMonth.setMonth(displayedCalendarMonth.getMonth() - 1);
            renderCropCalendar();
        });
    }

    const nextMonthButton = document.getElementById("nextCalendarMonth");
    if (nextMonthButton) {
        nextMonthButton.addEventListener("click", function () {
            displayedCalendarMonth.setMonth(displayedCalendarMonth.getMonth() + 1);
            renderCropCalendar();
        });
    }

    renderCropCalendar();

    const clearButton = document.getElementById("clearHistoryBtn");

    if (clearButton) {
        clearButton.addEventListener("click", clearSearchHistory);
    }
});


function getFertilizerGuidanceHTML(cropId) {
    const recommendation = farmDatabase.fertilizers.crop_recommendations
        .find(item => item.crop_id === cropId);

    if (!recommendation) {
        return `
            <section>
                <h3>Fertilizer Recommendations</h3>
                <p>
                    Fertilizer guidance for this crop is not available in the fertilizer database.
                </p>
                <p>
                    Consult a local agricultural extension officer
                    or a trusted crop-specific agricultural guide
                    before selecting a fertilizer.
                </p>
            </section>
        `;
    }

    const crop = getCropById(cropId);
    const products = farmDatabase.fertilizers.products;
    const programs = (recommendation.programs || []).map(program => `
        <article>
            <h4>${escapeHistoryText(program.label)}</h4>
            <ul>
                ${(program.steps || []).map(step => {
                    const product = products.find(item => item.product_id === step.product_id);
                    const reportedRate = step.reported;
                    const rate = typeof reportedRate?.min === "number"
                        ? `${reportedRate.min}${reportedRate.max !== reportedRate.min ? `–${reportedRate.max}` : ""} ${reportedRate.unit} per ${reportedRate.per}`
                        : "";
                    return `
                        <li>
                            <strong>${escapeHistoryText(step.timing)}${product ? ` — ${escapeHistoryText(product.name)}` : ""}</strong>
                            ${rate ? ` (${escapeHistoryText(rate)})` : ""}
                            <p>${escapeHistoryText(step.method)}</p>
                            ${step.notes ? `<p>${escapeHistoryText(step.notes)}</p>` : ""}
                        </li>
                    `;
                }).join("")}
            </ul>
        </article>
    `).join("");
    const cautions = (recommendation.cautions || []).map(caution =>
        `<li>${escapeHistoryText(caution)}</li>`
    ).join("");

    return `
        <section class="fertilizer-guidance">
            <h3>Fertilizer Advice for ${escapeHistoryText(getCropTitle(crop))}</h3>
            <p>${escapeHistoryText(recommendation.summary)}</p>
            ${programs}
            ${cautions ? `<h4>Important considerations</h4><ul>${cautions}</ul>` : ""}
        </section>
    `;
}

function renderFertilizerGuidance(cropName) {
    const recommendations = document.getElementById("fertilizerRecommendations");
    if (!recommendations) return;

    recommendations.innerHTML = cropName
        ? getFertilizerGuidanceHTML(cropName)
        : `<p class="fertilizer-prompt">Select a crop to see its fertilizer recommendations.</p>`;
}
