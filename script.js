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
console.log("FarmGuide JavaScript is connected!");


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
}

function normalizePlaceName(name) {
    return String(name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+county$/, "")
        .replace(/[^a-z0-9]/g, "");
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

    const locationInput =
        document.getElementById("location").value.trim();

    const crop =
        document.getElementById("crop").value;

    const result =
        document.getElementById("result");


    if (locationInput === "" || crop === "") {

        result.innerHTML = `
            <p>Please enter your location and select a crop.</p>
        `;

        return;
    }


    result.innerHTML = `
        <p>Finding your location...</p>
    `;

    try {
        const selectedCrop = getCropById(crop);
        if (!selectedCrop) {
            throw new Error("Crop details are not available in crops.json.");
        }

        // Find the location
        const location = await findLocation(locationInput);
        const countySoilProfile = getCountySoilProfile(location);


        result.innerHTML = `
            <p>Getting current weather...</p>
        `;


        // Get weather
        const weather =
            await getWeather(
                location.latitude,
                location.longitude
            );   
         saveSearchHistory(location.name, crop);

        const scheduledActivities = getCropActivities(crop, getCalendarStartDate());

        const analysis = analyzeCrop(selectedCrop, weather);
        const temperatureRange = selectedCrop.climate.temperature_c;
        const rainfallRange = selectedCrop.climate.rainfall_mm_per_year;
        const cropTitle = getCropTitle(selectedCrop);

        const currentTemperature =
            weather.current.temperature_2m;


        const currentRain =
            weather.current.rain;


        result.innerHTML = `

            <h2>${escapeHistoryText(cropTitle)} Information</h2>

            <hr>

            <h3>Location</h3>

            <p>
                <strong>Place:</strong>
                ${location.name}
            </p>

            <p>
                <strong>Country:</strong>
                ${location.country}
            </p>

            <p>
                <strong>Latitude:</strong>
                ${location.latitude}
            </p>

            <p>
                <strong>Longitude:</strong>
                ${location.longitude}
            </p>


            <hr>
            
            <hr>
            <h3>Soil and Water Advice</h3>

            <p>
                <strong>Water availability:</strong> ${irrigation || "Not specified"}</p>

            <div class="suitability">
                ${getSoilGuidanceHTML(countySoilProfile, selectedCrop)}
             </div>

             <h3>Current Weather</h3>

            <p>
                <strong>Temperature:</strong>
                ${currentTemperature}°C
            </p>

            <p>
                <strong>Current Rain:</strong>
                ${currentRain} mm
            </p>
            
            <hr>
            <h3>Crop Activity Calendar</h3>
            <p>Suggested activities are scheduled from ${formatCalendarDate(getCalendarStartDate(), {
                year: "numeric",
                month: "long",
                day: "numeric"
            })}.</p>
            <div class="calendar-list">
                ${scheduledActivities.length ? scheduledActivities.map(item => `
                    <div class="calendar-item">
                        <time datetime="${formatLocalDateValue(item.date)}">${formatCalendarDate(item.date)}</time>
                        <div>
                            <h4>${escapeHistoryText(item.stage)}</h4>
                            <p>${escapeHistoryText(item.activity)}</p>
                        </div>
                    </div>
                `).join("") : `<p>${escapeHistoryText(selectedCrop.calendar?.basis || "No activity plan is available for this crop.")}</p>`}
            </div>
            <p><a href="#cropCalendarSection">Open the monthly crop calendar</a></p>


            <hr>


            <h3>Crop Requirements</h3>

            <p>
                <strong>Temperature:</strong>
                ${temperatureRange.optimal_min}°C -
                ${temperatureRange.optimal_max}°C
            </p>

            <p>
                <strong>Rainfall:</strong>
                ${rainfallRange.optimal_min}–${rainfallRange.optimal_max} mm per year
            </p>

            <hr>
            
            <hr>

            <h3>Crop Suitability Analysis</h3>

            <div class="suitability">
            <p>
                <strong>Preliminary indicator score:</strong>
            ${analysis.score}/100
            </p>

            <p>
                <strong>Temperature:</strong>
                ${analysis.temperatureSuitable ? "Within target range" : "Outside target range"}
            </p>

            <p>
                <strong>Rain forecast (7 days):</strong>
                ${analysis.forecastRain.toFixed(1)} mm
            </p>

            <p>
                <strong>Rainfall indicator:</strong>
                ${analysis.rainfallSuitable ? "Within prototype target range" : "Outside prototype target range"}
            </p>

             <p>${analysis.recommendation}</p>
            </div>


            <h3>7-Day Weather Forecast</h3>

            <div class="forecast">

                ${weather.daily.time.map((date, index) => `

                    <div class="forecast-day">

                        <strong>${date}</strong>

                        <p>
                            Max:
                            ${weather.daily.temperature_2m_max[index]}°C
                        </p>

                        <p>
                            Min:
                            ${weather.daily.temperature_2m_min[index]}°C
                        </p>

                        <p>
                            Rain:
                            ${weather.daily.rain_sum[index]} mm
                        </p>

                    </div>

                `).join("")}

            </div>

        `;

    } catch (error) {

        result.innerHTML = `
            <p>
                ${error.message}
            </p>

            <p>
                Please check the location name and try again.
            </p>
        `;
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
