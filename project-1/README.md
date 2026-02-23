# Project Overview: Our World In Data 🌍 

## 1. Project Goal
The purpose of this project is to explore intuitive and visually engaging ways to present real‑world data.  
For this initial release, the following global demographic datasets are included:

- **Population by nation**
- **Median age by nation**
- **Life expectancy by nation**
- **Population growth rate by nation**

The webpage is designed with extensibility in mind—new datasets can be added with minimal effort.

These particular metrics were chosen out of a curiosity about how global population patterns have shifted over time, especially in a world where concerns about overpopulation and resource demand are increasingly relevant. Together, these datasets offer a compelling look at demographic trends and how they interact.

---

## 2. Documentation
*This section will be expanded in a future update.*

---

## 3. Walkthrough

A full, detailed walkthrough—covering all features, attributes, and design decisions—will be available here:  
**([Project 1: Walkthrough](https://github.com/DylanBvPro/Visual-Interfaces-Projects/wiki/Project-1:-Walkthrough))**


### Quick Start

1. Launch the project locally, or connect to the hosted version.  
2. Navigate to **Project 1** using the top banner or the Projects section.  
3. You will arrive at the **Single Statistic Charts** page.

<img width="1881" height="910" alt="image" src="https://github.com/user-attachments/assets/dd49297f-1412-40ec-83d2-1ef03a267fa4" />

On the right side of the page, you’ll find a dropdown menu that allows you to select which dataset you want to view. When you choose a dataset, all charts on the page will automatically update to reflect your selection.

You can also **click and drag** across the scatterplot to highlight specific data points. Any point partially within the drag area will be isolated, and the comparative analysis charts will update to show only the selected countries.

To add or remove countries manually, use the **checkbox list** in the search bar on the right side of the scatterplot.

Hovering over any data point will display additional details about that specific value.

For dense datasets, you can use the **up and down arrow keys** to move between nearby points, making it easier to explore crowded regions of the chart.

![Recording 2026-02-23 032635](https://github.com/user-attachments/assets/a0e8c22c-df4b-4fd9-83f4-e130e0b49859)

Scrolling down, you’ll find the **bar chart**, which is linked to the selected dataset and includes a **play bar** that animates the data across all available years.

![Recording 2026-02-23 033054](https://github.com/user-attachments/assets/0a693a8e-fd9e-4f65-8dac-c9b853e1dce1)

Below the bar chart is the **interactive world map**, which can be hovered over for additional details and also includes a play bar to animate the dataset across relevant years.

![Recording 2026-02-23 033753](https://github.com/user-attachments/assets/4db85f28-dc9f-411a-9521-321a56ce8148)

Next, navigate to the top banner and click on **Comparative Analysis Charts**.

This page will look similar to the **Single Statistic Charts** page, but here you can interact with multiple variables at once. The following controls are available:

- **R** — controls the size of each circle (radius) 
- **X** — sets the variable for the horizontal axis  
- **Y** — sets the variable for the vertical axis   
- **Data Visualization Type** — defaults to *Scatterplot*; all other options are experimental and may behave unpredictably
- **Year** — available only when neither X nor Y is set to *Year*  

This page allows you to explore relationships between variables and visualize how different metrics interact across countries and years.

![Recording 2026-02-23 035511](https://github.com/user-attachments/assets/806fdd05-42b9-4d74-b7b5-e35e9919b19d)

For a more extensive demo with additional details and images, please refer to the **Project 1: Walkthrough** page.

---

## 4. Findings
*This section will be filled in as analysis is completed.*

---

## 5. Acknowledgements

**Data Sources**  
- Global demographic data provided by **Our World in Data**  
  [https://ourworldindata.org/](https://ourworldindata.org/)

**UI Boilerplate**  
- Initial multi‑page HTML structure adapted from this CodeSandbox template, then modified with the assistance of A.I.  
  [CodeSandbox Template](https://codesandbox.io/p/sandbox/multi-page-html-0ejcp?file=%2Fpages%2Fabout.html%3A14%2C3-15%2C1)

**Country ISO Code Mapping**  
- Base ISO2 conversion logic derived in part from this implementation:  
  [vtex/country-iso-3-to-2](https://github.com/vtex/country-iso-3-to-2/blob/master/index.js)

**CSS & UI Enhancements**  
- Popup and interface element techniques referenced from GeeksforGeeks tutorials  
  [How to Create a Popup Box](https://www.geeksforgeeks.org/html/how-to-create-popup-box-using-html-and-css/)

**Data Visualization Inspiration**  
- Statistical distribution references and visualization ideas from DataScienceDojo  
  [Types of Statistical Distributions in ML](https://datasciencedojo.com/blog/types-of-statistical-distributions-in-ml/)

**Design Inspiration**
- Gapminder heavily influenced the early design direction and goals of this project, especially its interactive and comparative visual style.  
  [Explore their platform](https://www.gapminder.org/tools)

**Development Assistance**  
- GitHub Copilot provided support during development and debugging.

**Writing & Editing Support**  
- Copilot assisted with spelling, punctuation, and clarity improvements throughout this wiki page.

---

## 6. Final Thoughts / Conclusion

### A. Reflections  
This project became a genuinely engaging exploration of D3, data distribution, and data manipulation. Working through the challenges pushed me to better understand how visual encodings, interactivity, and dataset structure all influence the final result.  

I’ll be honest: without the ability to use AI tools, I would have had to significantly scale back the scope. AI accelerated the tedious parts—debugging, spacing adjustments, date calculations, and general troubleshooting—allowing me to focus more on design decisions and experimentation. It feels only right to acknowledge GitHub Copilot and other AI assistants for the support they provided throughout development.

### B. Looking Ahead  
If I had more time (and fewer competing priorities), my next step would be a full cleanup pass on the codebase. Right now, I estimate there’s roughly **10–15% redundant code** and **5–10% dead or legacy code** lingering from earlier iterations. With additional time, I would consolidate repeated logic, remove bloat, and bring everything in line with cleaner development practices.  

**View the most up‑to‑date version on the online wiki.**