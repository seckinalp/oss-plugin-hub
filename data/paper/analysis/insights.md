# Plugin Analysis Insights

Generated at: 2025-12-29T17:16:35.458565+00:00Z

## Overview
- Total rows: 900
- Platforms: chrome, firefox, homeassistant, jetbrains, minecraft, obsidian, sublime, vscode, wordpress

## Missingness (Top 15)
| column                          | missing_rate       |
| ------------------------------- | ------------------ |
| vendor_url                      | 1.0                |
| repository                      | 1.0                |
| openssf_score_date              | 1.0                |
| openssf_scorecard_version       | 1.0                |
| openssf_score                   | 1.0                |
| sbom_analysis_dependencies_json | 1.0                |
| pr_friction_samples             | 1.0                |
| published_date                  | 0.8944444444444445 |
| sources_json                    | 0.8922222222222222 |
| source                          | 0.8922222222222222 |
| source_id                       | 0.8922222222222222 |
| xml_id                          | 0.8911111111111111 |
| release_date                    | 0.89               |
| openssf_score_error             | 0.8888888888888888 |
| openssf_status                  | 0.8888888888888888 |

## Platform Summary
| platform      | plugins | total_downloads | avg_downloads     | median_downloads | total_stars | avg_stars | median_stars | avg_rating        | avg_scorecard      |
| ------------- | ------- | --------------- | ----------------- | ---------------- | ----------- | --------- | ------------ | ----------------- | ------------------ |
| chrome        | 100     | 233670000.0     | 2336700.0         | 700000.0         | 791751      | 7917.51   | 1458.5       | 3.688888888888889 | 3.4799999999999995 |
| firefox       | 100     | 17242577.0      | 172425.77         | 30658.0          | 479809      | 4798.09   | 317.0        | 4.382076595744681 | 3.0823529411764707 |
| homeassistant | 100     | 4356695.0       | 43566.95          | 30368.0          | 71025       | 710.25    | 423.5        | 0.0               | 3.1285714285714286 |
| jetbrains     | 100     | 587304466.0     | 5873044.66        | 3103416.0        | 501545      | 5015.45   | 994.5        |                   | 3.5113636363636362 |
| minecraft     | 100     | 2217620403.0    | 22176204.03       | 15930227.0       | 30385       | 303.85    | 116.0        | 0.0               | 3.4621052631578944 |
| obsidian      | 100     | 38734337.0      | 387343.37         | 169731.5         | 91575       | 915.75    | 450.5        |                   | 2.782142857142857  |
| sublime       | 100     | 49475544.0      | 494755.44         | 303714.0         | 59452       | 594.52    | 281.0        |                   | 2.807608695652174  |
| vscode        | 100     | 2950813730.0    | 29508137.3        | 16729809.5       | 184466      | 1844.66   | 829.5        | 4.080952054338701 | 4.373333333333333  |
| wordpress     | 100     | 7180000.0       | 72525.25252525252 | 40000.0          | 31718       | 317.18    | 39.5         | 88.27659574468085 | 2.9347222222222222 |

## Coverage Rates
- scorecard: 0.750
- sbom: 1.000
- osv: 1.000

## Top Findings (Effect Size + Significance)
| category_type | category                | metric    | n_category | n_other | mean_diff           | median_diff         | cohens_d             | mann_whitney_p         | adj_beta              | adj_p                  | platform_top  | platform_share      | low_sample |
| ------------- | ----------------------- | --------- | ---------- | ------- | ------------------- | ------------------- | -------------------- | ---------------------- | --------------------- | ---------------------- | ------------- | ------------------- | ---------- |
| specific      | testing_debugging       | downloads | 23         | 1724    | 25839310.064813882  | 14758539.0          | 1.7121286079170641   | 1.191780306704585e-06  | 0.32168407969946344   | 0.03001925017910772    | vscode        | 0.6086956521739131  | False      |
| specific      | integrations_connectors | rating    | 70         | 941     | 35.13508910471807   | 71.88321161270142   | 1.0530325942649836   | 6.991968594133731e-13  |                       |                        | wordpress     | 0.4148936170212766  | False      |
| specific      | developer_tools         | rating    | 99         | 912     | 25.175955501535803  | 0.6727882072448734  | 0.7466705849864581   | 9.980325425330985e-14  |                       |                        | wordpress     | 0.33098591549295775 | False      |
| specific      | language_support        | downloads | 119        | 1628    | 8766847.661377573   | 7783891.0           | 0.5761106273084017   | 2.0882343405289354e-19 | 0.027052188959625134  | 0.6910490982793742     | jetbrains     | 0.40336134453781514 | False      |
| generic       | language_support        | downloads | 94         | 1643    | 7306574.486901232   | 4003286.5           | 0.4729089532756255   | 1.2924187837808913e-09 | 0.15607414025581756   | 0.03502348688543389    | vscode        | 0.30851063829787234 | False      |
| specific      | productivity_workflow   | rating    | 110        | 901     | -15.926896569073236 | 0.19123723983764584 | -0.46595933614673546 | 0.02005993688674068    |                       |                        | obsidian      | 0.31086142322097376 | False      |
| specific      | customization_theming   | rating    | 43         | 968     | -14.510459953963569 | 0.3822000000000001  | -0.42163293112241584 | 0.0041649620484357506  |                       |                        | firefox       | 0.54                | False      |
| specific      | customization_theming   | downloads | 50         | 1697    | -6398108.424843842  | -325471.5           | -0.4170905989024076  | 5.230831045711786e-05  | -0.06967956199010783  | 0.5164503291552098     | firefox       | 0.54                | False      |
| specific      | media_entertainment     | downloads | 21         | 1726    | -6282069.784500359  | -355733.0           | -0.4089441655614201  | 0.0003140986890501362  | 0.11010809469509575   | 0.5045293068626153     | firefox       | 0.6190476190476191  | False      |
| generic       | navigation_search       | downloads | 34         | 1703    | -6030873.730112949  | -279451.0           | -0.3886858922276643  | 6.685158338110678e-05  | 0.05235292766478161   | 0.6412508567867512     | firefox       | 0.4117647058823529  | False      |
| specific      | code_quality_linting    | downloads | 49         | 1698    | 5209943.477704862   | 4482260.0           | 0.33934725158997087  | 4.99304257414812e-06   | -0.10064615530133869  | 0.29691951482093437    | jetbrains     | 0.3673469387755102  | False      |
| generic       | integrations_connectors | downloads | 78         | 1659    | -4784431.342977697  | -353665.0           | -0.3085355791986299  | 2.1875095778104575e-08 | 0.0026211818658773423 | 0.972922494692017      | homeassistant | 0.34615384615384615 | False      |
| generic       | navigation_search       | rating    | 25         | 1028    | 10.824945595248828  | 0.48288725433349633 | 0.3081269832724998   | 0.015962028670915746   |                       |                        | firefox       | 0.4117647058823529  | False      |
| generic       | content_media           | downloads | 18         | 1719    | -4599194.851367073  | -296165.5           | -0.2961190677961584  | 0.0066866912007329925  | -0.3178292557346586   | 0.0480324792796024     | firefox       | 0.3888888888888889  | False      |
| generic       | privacy_security        | downloads | 72         | 1665    | -4479751.81493994   | -256958.0           | -0.2887767604186761  | 0.0011372522978031526  | 0.48694202675959586   | 1.3480870272289798e-06 | firefox       | 0.5                 | False      |

## Correlations
| metric_a           | metric_b           | n   | pearson_r            | pearson_p              | spearman_r          | spearman_p              |
| ------------------ | ------------------ | --- | -------------------- | ---------------------- | ------------------- | ----------------------- |
| stars_value        | downloads_value    | 899 | 0.008465106493679247 | 0.7999100811218272     | 0.25194333562924226 | 1.752307323214659e-14   |
| stars_value        | github_open_issues | 900 | 0.18260728189518002  | 3.447238843137979e-08  | 0.6409809554486522  | 2.7982599394385872e-105 |
| stars_value        | scorecard_score    | 675 | 0.18670846110530392  | 1.03504759373794e-06   | 0.29108285428766656 | 1.1981197923477446e-14  |
| downloads_value    | github_open_issues | 899 | 0.11883165506895806  | 0.00035606907350686356 | 0.24858578829415692 | 3.9669587631171764e-14  |
| downloads_value    | scorecard_score    | 674 | 0.41589995818165876  | 1.4214503782064412e-29 | 0.347367590066891   | 1.5091055799555048e-20  |
| github_open_issues | scorecard_score    | 675 | 0.30589880763824684  | 4.350045537732865e-16  | 0.29730331686939615 | 3.0482111103363522e-15  |

## Outliers
### stars_value
| plugin_name                    | platform  | stars_value | repo                          |
| ------------------------------ | --------- | ----------- | ----------------------------- |
| React Developer Tools          | chrome    | 240888      | facebook/react                |
| React Developer Tools          | firefox   | 240886      | facebook/react                |
| uBlock Origin                  | chrome    | 59993       | gorhill/uBlock                |
| uBlock Origin                  | firefox   | 59992       | gorhill/uBlock                |
| PDF Viewer                     | chrome    | 52324       | mozilla/pdf.js                |
| Alibaba Java Coding Guidelines | jetbrains | 30774       | alibaba/p3c                   |
| Refined GitHub                 | chrome    | 29788       | refined-github/refined-github |
| Lighthouse                     | chrome    | 29589       | GoogleChrome/lighthouse       |
| Google Lighthouse              | firefox   | 29588       | GoogleChrome/lighthouse       |
| Vimium                         | chrome    | 25645       | philc/vimium                  |

### downloads_value
| plugin_name                | platform  | downloads_value | repo                                |
| -------------------------- | --------- | --------------- | ----------------------------------- |
| Python                     | vscode    | 188638413.0     | Microsoft/vscode-python             |
| Pylance                    | vscode    | 156525374.0     | microsoft/pylance-release           |
| Jupyter                    | vscode    | 96958328.0      | Microsoft/vscode-jupyter            |
| Python Debugger            | vscode    | 94004998.0      | microsoft/vscode-python-debugger    |
| C/C++                      | vscode    | 89407997.0      | Microsoft/vscode-cpptools           |
| Fabric API                 | minecraft | 86755692.0      | FabricMC/fabric                     |
| Sodium                     | minecraft | 82656542.0      | CaffeineMC/sodium                   |
| Jupyter Keymap             | vscode    | 76835715.0      | Microsoft/vscode-jupyter-keymap     |
| Jupyter Notebook Renderers | vscode    | 75920747.0      | Microsoft/vscode-notebook-renderers |
| Live Server                | vscode    | 69910767.0      | ritwickdey/vscode-live-server       |

### github_open_issues
| plugin_name                                     | platform  | github_open_issues | repo                                     |
| ----------------------------------------------- | --------- | ------------------ | ---------------------------------------- |
| I still don't care about cookies                | chrome    | 8883               | OhMyGuus/I-Still-Dont-Care-About-Cookies |
| Gutenberg                                       | wordpress | 7604               | WordPress/gutenberg                      |
| MetaMask                                        | chrome    | 2505               | MetaMask/metamask-extension              |
| Live Server                                     | vscode    | 2360               | ritwickdey/vscode-live-server            |
| AI Grammar Checker & Paraphraser – LanguageTool | chrome    | 2056               | languagetool-org/languagetool            |
| LanguageTool                                    | chrome    | 2056               | languagetool-org/languagetool            |
| Vim                                             | vscode    | 1827               | VSCodeVim/Vim                            |
| C/C++                                           | vscode    | 1399               | Microsoft/vscode-cpptools                |
| C/C++ Themes                                    | vscode    | 1399               | Microsoft/vscode-cpptools                |
| C/C++ Extension Pack                            | vscode    | 1399               | microsoft/vscode-cpptools                |

