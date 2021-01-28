chrome.runtime.onInstalled.addListener(function() {
    // Initialize block list
    chrome.storage.sync.set({'blockList': []}, function() {
        console.log('Initialize block list');
    });
    // Initialize task list
    chrome.storage.sync.set({'taskList': []}, function() {
        console.log('Initialize task list');
    });
    // Initialize points for user
    chrome.storage.sync.set({'points': 0}, function() {
        console.log('Initialized points to 0');
    });
    // Disable blocking on startup
    chrome.storage.sync.set({'blockingEnabled': false}, function() {
        console.log('Set blockingEnabled to false');
    });
});

function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
}

class Task {
    constructor(name, description, deadline, reward) {
        this.taskID = uuidv4();
        this.name = name;
        this.description = description;
        this.deadline = deadline;
        this.reward = reward;
        this.complete = false
    }
}

// toString for debugging purposes
Task.prototype.toString = function() {
    return this.name;
}

// Block sites
function handleTabChange(activeInfo) {
    // Gives details of the active tab in the current window.
    chrome.storage.sync.get(['blockingEnabled'], function(blockingResult) {
        chrome.tabs.query({'active':true,'currentWindow':true},function(array_of_tabs){
            // get list of blocked sites from storage
            let currentUrl = array_of_tabs[0].url;
            chrome.storage.sync.get(['blockList'], function(result) {
                let blockList = result.blockList;
                for (let i = 0; i < blockList.length; i++) {
                    // if url in blocked sites list, pass message to content (for blocking)
                    if (currentUrl.includes(blockList[i]) && blockingResult.blockingEnabled) {
                        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                            var activeTab = tabs[0];
                            chrome.tabs.sendMessage(activeTab.id, {"blockLink": currentUrl});
                        });
                    }
                }
            });
        });
    });
}

chrome.tabs.onActivated.addListener(handleTabChange);
chrome.tabs.onUpdated.addListener(handleTabChange);

// Add site to block list
function addBlockSite(siteUrl) {
    // disable buttons here
    chrome.storage.sync.get(['blockList'], function(result) {
        result.blockList.push(siteUrl);
        chrome.storage.sync.set({'blockList': result.blockList}, function() {
            console.log('Added ' + siteUrl + ' to block list');
            // enable buttons here
        });
    });
}

// removes a site from the block list
function removeBlockSite(siteUrl) {
    chrome.storage.sync.get(['blockList'], function(result) {
        let index = -1;
        let blockList = result.blockList;
        for(let i = 0; i < blockList.length; i++) {
            if(blockList[i] === siteUrl) {
                index = i;
                break;
            }
        }
        if(index != -1) {
            blockList.splice(index, 1);
            chrome.storage.sync.set({'blockList': blockList}, function() {
                console.log('Removed ' + siteUrl + ' from the block list');
            });
        } else {
            console.log("removing invalid task");
        }
    });
}

// adds a task to the task list
// returns the uuid of the task
function addTask(taskName, taskDescription, taskDeadline, taskReward) {
    // disable buttons here
    let task = new Task(taskName, taskDescription, taskDeadline, taskReward);
    chrome.storage.sync.get(['taskList'], function(result) {
        result.taskList.push(task);
        chrome.storage.sync.set({'taskList': result.taskList}, function() {
            console.log('Added ' + task.name + ' to task list with id '+ task.taskID);
            // enable buttons here
        });
    });
    return task.taskID;
}

// removes a task from the task list by uuid
function removeTask(taskID) {
    chrome.storage.sync.get(['taskList'], function(result) {
        let index = -1;
        let taskList = result.taskList;
        for(let i = 0; i < taskList.length; i++) {
            if(taskList[i].taskID === taskID) {
                index = i;
                break;
            }
        }
        if(index != -1) {
            taskList.splice(index, 1);
            chrome.storage.sync.set({'taskList': taskList}, function() {
                console.log('Removed ' + taskID + ' from the task list');
            });
        } else {
            console.log("removing invalid task");
        }
    });
}

// spend points to unblock all the sites
// temporarily equate 1 point to 1 minute
function unblockSites(time_limit) {
    chrome.storage.sync.get(['points'], function(result) {
        let points = result.points;
        if (time_limit && points == 0) {
            return;
        }

        chrome.storage.sync.set({'blockingEnabled': false}, function() {
            console.log('Set blockingEnabled to false');
        });

        if (time_limit) {
            setTimeout(blockSites, 1000*60*points);
            chrome.storage.sync.set({'points': 0}, function() {
                console.log('Set points to 0');
            });
            alert("Blocking disabled for " + points + " minutes")
        }
    });
}

// block sites again
function blockSites() {
    chrome.storage.sync.set({'blockingEnabled': true}, function() {
        console.log('Set blockingEnabled to true');
    });
}

// Receive request to add task
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.message == "addTask") {
            addTask(request.taskName, 
                request.taskDescription, 
                request.taskDateTime, 
                request.taskReward);
        }
        else if (request.message == "addBlock") {
            addBlockSite(request.blockSite);
        } else if (request.message == "remove") {
            removeBlockSite(request.blockSite);
        } else if (request.message == "startBlocking") {
            blockSites();
        } else if (request.message == "override") {
            unblockSites(false);
        } else if (request.message == "stopBlocking") {
            unblockSites(true)
        } else if (request.message == "removeTask") {
            removeTask(request.removeTask)
        }
        sendResponse({})
    }
    );