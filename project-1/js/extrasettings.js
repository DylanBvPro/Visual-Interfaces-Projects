//Add by hand
const rOptions = ['Population', 'Growth Rate', 'Median Age', 'Life Expectancy'];

const axisOptions = [
    { value: "year", label: "Year" },
    { value: "population", label: "Population" },
    { value: "growthRate", label: "Growth Rate" },
    { value: "medianAge", label: "Median Age" },
    { value: "lifeExpectancy", label: "Life Expectancy" }
];

const dataVisualizationOptions = [
    { value: "scatterplot", label: "Scatter Plot" },
    { value: "heatmap", label: "Heatmap" },
    { value: "bellcurveScatterplot", label: "T-Score (Median-Centered)" }
];

function createDropdown(id, labelText, options, defaultValue) {
    const container = document.createElement("div");
    container.className = "variable-container";

    const label = document.createElement("label");
    label.textContent = labelText + ": ";
    label.htmlFor = id;
    label.className = "variable-label";

    const select = document.createElement("select");
    select.id = id;
    select.className = "variable-select";

    options.forEach(optionValue => {
        const option = document.createElement("option");

        if (typeof optionValue === "object") {
            option.value = optionValue.value;
            option.textContent = optionValue.label;
            if (defaultValue && optionValue.value === defaultValue) {
                option.selected = true;
            }
        } else {
            option.value = optionValue;
            option.textContent = optionValue;
            if (defaultValue && optionValue === defaultValue) {
                option.selected = true;
            }
        }

        select.appendChild(option);
    });

    select.addEventListener("change", emitCompareSettings);

    container.appendChild(label);
    container.appendChild(select);

    return container;
}

function emitCompareSettings() {
    const rOption = document.getElementById("rSelect")?.value || "Growth Rate";
    const xOption = document.getElementById("xSelect")?.value || "year";
    const yOption = document.getElementById("ySelect")?.value || "growthRate";
    const yearInput = document.getElementById("yearFilter");
    const yearFilter = yearInput?.value ? Number(yearInput.value) : null;
    const dataVisualization = document.getElementById("dataVisualizationSelect")?.value || "scatterplot";

    const xMode = xOption;
    const yMode = yOption;

    window.dispatchEvent(new CustomEvent("compareSettingsChanged", {
        detail: { xMode, yMode, rOption, xOption, yOption, yearFilter, dataVisualization }
    }));

    updateYearFieldState();
}

function updateYearFieldState() {
    const xOption = document.getElementById("xSelect")?.value;
    const yOption = document.getElementById("ySelect")?.value;
    const yearInput = document.getElementById("yearFilter");
    const yearContainer = document.getElementById("yearFilterContainer");

    if (yearInput && yearContainer) {
        const yearInUse = xOption === 'year' || yOption === 'year';
        yearInput.disabled = yearInUse;
        yearContainer.style.opacity = yearInUse ? '0.5' : '1';
        
        if (yearInUse) {
            yearInput.value = '';
        } else if (!yearInput.value) {
            // Auto-fill with 2020 when year field becomes enabled and is empty
            yearInput.value = '2020';
            // Emit settings again to apply the auto-filled year
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent("compareSettingsChanged", {
                    detail: {
                        xMode: xOption,
                        yMode: yOption,
                        rOption: document.getElementById("rSelect")?.value,
                        xOption: xOption,
                        yOption: yOption,
                        yearFilter: 2020,
                        dataVisualization: document.getElementById("dataVisualizationSelect")?.value || "scatterplot"
                    }
                }));
            }, 0);
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const wrapper = document.createElement("div");
    wrapper.className = "variable-wrapper";
    wrapper.id = "compare-settings";

    wrapper.appendChild(createDropdown("rSelect", "R", rOptions, "Growth Rate"));
    wrapper.appendChild(createDropdown("xSelect", "X", axisOptions, "year"));
    wrapper.appendChild(createDropdown("ySelect", "Y", axisOptions, "lifeExpectancy"));
    wrapper.appendChild(createDropdown("dataVisualizationSelect", "Data Visualization", dataVisualizationOptions, "scatterplot"));
    const yearContainer = document.createElement("div");
    yearContainer.className = "variable-container";
    yearContainer.id = "yearFilterContainer";

    const yearLabel = document.createElement("label");
    yearLabel.textContent = "Year: ";
    yearLabel.htmlFor = "yearFilter";
    yearLabel.className = "variable-label";

    const yearInput = document.createElement("input");
    yearInput.type = "number";
    yearInput.id = "yearFilter";
    yearInput.className = "variable-select";
    yearInput.placeholder = "e.g. 2020";
    yearInput.min = "1900";
    yearInput.max = "2100";
    yearInput.addEventListener("input", emitCompareSettings);

    yearContainer.appendChild(yearLabel);
    yearContainer.appendChild(yearInput);
    wrapper.appendChild(yearContainer);

    // Select All button
    const selectAllButton = document.createElement("button");
    selectAllButton.textContent = "Select All";
    selectAllButton.className = "select-all-button";
    selectAllButton.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("selectAllCountries"));
    });
    wrapper.appendChild(selectAllButton);

    // Clear All button
    const clearAllButton = document.createElement("button");
    clearAllButton.textContent = "Clear All";
    clearAllButton.className = "clear-all-button";
    clearAllButton.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("clearAllCountries"));
    });
    wrapper.appendChild(clearAllButton);

    const output = document.createElement("p");
    output.className = "variable-output";
    output.id = "compare-settings-output";

    wrapper.appendChild(output);

    const settingsAnchor = document.getElementById("compare-settings-anchor");
    const fallbackAnchor = document.getElementById("page-content");
    const parent = settingsAnchor || fallbackAnchor || document.body;
    parent.appendChild(wrapper);

    // Initialize with defaults
    emitCompareSettings();
});