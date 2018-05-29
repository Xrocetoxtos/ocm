// ==UserScript==
// @name         CS_Lidwinia
// @version      0.4
// @author       M. Kleuskens
// @include      *cyclingsimulator.com*
// @grant        none
// @downloadURL	https://github.com/Starlynk/CS_Lidwinia/raw/master/CS_Lidwinia.user.js
// @updateURL	  https://github.com/Starlynk/CS_Lidwinia/raw/master/CS_Lidwinia.user.js
// @require      http://code.jquery.com/jquery-1.11.3.min.js
// ==/UserScript==

//Version 0.4 Changes:
//1. Complete rewrite of code so it no longer injects scripts at multiple places
//2. Show to which races riders are signed up
//3. Made sure extra info on race break and riders stays on page, even after an AJAX update.
//4. Added exact AV to riderprofile page
//5. Added DP trading table
//6. Added DP Now and +1 (on mouseover) to RB table
//7. Added job availability to economy page

//Global variables
var mut_config = { attributes: true, childList: true, characterData: true }; //Standard check for mutation observers
var mut_config2 = { attributes: true }; //Only check for attributes (for rider profiles, to avoid multiple triggers)
var ownTeam = $("#menu").find("b:first").text();//Logged team is always the first bold tag in the menu.
var team; //Gives the team to use in funtions. Can be own team or change per rider.
var riderlistID = document.querySelector('#riderlist'); //Check for element with riderlist ID
var ridersonbreakID = document.querySelector('#ridersonbreak'); //Check for element with ridersonbreak ID
var riderID //RiderID used in functions; empty to start with.
var riders=[]; //Element with all riders on the page
var jobs=[]; //Element with all jobs
var test

//Following for signed up races
var races = document.createElement("div"); //Races is an div with all the races in which a team is participated
var sup=[];

//Following for racebreak
var rb_doc_impact; //impact of RB doctor
var rb_days;
var rb_hours;
var rb_hour;
var rb_rise;
var cur_rise;
var next_rise;
var hours_dp99=0;

//Following for checks to avoid running code multiple times if not necessary
var redesign; //redesign is a variable that's empty if the redesign of the current page isn't done yet, and set to done if it is (to prevent multiple redesigns)
var rider_observer_set;

//Following only when on a team page:
if(window.location.href.indexOf("/team/") > -1 || window.location.search.indexOf("Team") > -1)
{
    team = $("h1:first").text().trim(); //Name of the team is the first h1 tag on a team page  
    getRaces(team); //Get races which a team is signed up for
    if(team==ownTeam)
    {
        $("#riderlist").next("table").next("table").after("<h1 id='dpt'><a href=#1>Click here for DP trading table</a></h1>");
        document.getElementById ("dpt").addEventListener ("click", dp_trading, false);
    }
}

if(window.location.search.indexOf("Economy") > -1)
{
    getJobsAvailability()
    $("[width=700]:last").parents("table:first").after('<BR>'+
                                                       '<table cellpadding="0" cellspacing="0" width = "700" title = "Based on messages on overview page">'+
                                                       '<tr id = "jobsAvailableTitle" width="700" background="http://www.cyclingsimulator.com/Design/box_top_mid.gif" height="17">'+
                                                       '<td width="8" background="http://www.cyclingsimulator.com/Design/box_top_left_white.gif"></td>'+
                                                       '<td width="264"><span class="boxtitle">Jobs</span></td>'+
                                                       '<td width="400"><span class="boxtitle">Approximate next availability (based on messages on overview page)</span></td>' +
                                                       '<td></td>' +
                                                       '<td width="8" background="http://www.cyclingsimulator.com/Design/box_top_right_white.gif"></td>'+
                                                       '</tr></table>'+
                                                       '<table id="jobsAvailable" cellpadding="0" cellspacing="0" width = "700" title = "Based on messages on overview page">'+
                                                       '</table>'
                                                      );
    //alert(jobs.length);
    for(j=0;j<jobs.length;j++)
    {
        if ($("span.text:contains('"+jobs[j]['name']+"'):first").text() == '')
        {
            var tr_color = "DDDDDD";
            if (j%2 == 0) {tr_color = "DDDDDD"} else {tr_color = "EEEEEE"};
            $("#jobsAvailable").append('<tr bgcolor='+tr_color+' height="19">'+
                                       '<td width="1" background="http://www.cyclingsimulator.com/Design/box_border.gif"></td>'+
                                       '<td width="7"></td>'+
                                       '<td width="264"><span class="text">'+jobs[j]['name']+'</span></td>'+
                                       '<td width="400"><span class="text">'+jobs[j]['nextAvailable']+'</span></td>'+
                                       '<td></td>'+
                                       '<td width="1" background="http://www.cyclingsimulator.com/Design/box_border.gif"></td>'+
                                       '</tr>');
        }
    }
    $("#jobsAvailable").append('<tr background="http://www.cyclingsimulator.com/Design/box_border.gif" height="1"><td></td><td></td><td></td><td></td><td></td><td></td></tr>');
}

//Following only when there's a riderlist
if(riderlistID)
{
    var riderlist_observer = new MutationObserver(improveRiderlist);
    riderlist_observer.observe(riderlistID, mut_config);

    //Also trigger it once to start
    improveRiderlist();
}

//Following only when there's a ridersonbreak
if(ridersonbreakID)
{
    var onbreak_observer = new MutationObserver(improveOnBreak);
    onbreak_observer.observe(ridersonbreakID, mut_config);

    //Also trigger it once to start
    improveOnBreak();
}


//Below are all functions that are used

//Function riderObserver: Checks for changes in riderprofile to trigger improveRiderProfile, once a profile is opened
function riderObserver()
{
    //Load all elements which ID's starting with riderprofile into riderprofiles
    var riderprofiles = $('[id^="riderprofile"]');
    for(r=0;r<riderprofiles.length;r++)
    {
        //For each element, trigger the Mutation Observer to improve the profile once loaded.
        riderprofile=$(riderprofiles[r]).attr("id");
        riderprofileID = document.querySelector("#"+riderprofile);
        rider_observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                improveRiderProfile($(mutation.target).attr("id"));               
            });
        });
        rider_observer.observe(riderprofileID, mut_config2);
    }
}

//Function getRaces: Gets all races from a certain team (needs bugfixing for U23)
function getRaces(team)
{
    races.innerHTML=$.ajax({ url: "http://www.cyclingsimulator.com/?page=Participating&team="+team.replace(" ","+"), global: false, async:false, success: function(data) {return data;} }).responseText;
    raceNames = $(races).find("[width=712]").find("h1");
    races = $(races).find("[width=712]").find("a");   

    sup[1]=$(raceNames[1]).text();
    sup[2]=$(raceNames[3]).text();
    sup[3]=$(raceNames[5]).text();
    sup[4]=$(raceNames[7]).text();
    sup[5]=$(raceNames[9]).text();
    sup[6]=$(raceNames[11]).text();
    sup[7]=$(raceNames[13]).text();
    sup[8]=$(raceNames[15]).text();
    sup[9]=$(raceNames[17]).text();
}

function getRiders()
{
    //Following skills will be added to riders
    var skills = ["age","CL","DH","HL","SP","FR","CB","TQ","TT","DP","RS","AV"];

    if(riderlistID)
    { 
        var rlistDiv = $(riderlistID).find("div");
        var rlistNames = $(riderlistID).find("a");
        var rlistSkills = $(riderlistID).find("p.right");
    }
    else
    {
        var rlist = document.createElement("div");
        rlist.innerHTML=$.ajax({ url: "http://www.cyclingsimulator.com/ajax_riderlist.php?page=Teams&team="+ownTeam.replace(" ","+"), global: false, async:false, success: function(data) {return data;} }).responseText;
        var rlistDiv = $(rlist).find("div");
        var rlistNames = $(rlist).find("a");//Link is rider
        var rlistSkills = $(rlist).find("p.right");//Skills are right aligned 
    }
    //On the hirelist there are 13 columns instead of 12
    var cNumber=12
    if(window.location.search.indexOf("Hire") > -1) 
    { 
        cNumber=13;
    }

    if (rlistDiv.length > 0)
    {
        for(r=0;r<rlistDiv.length;r++)
        {
            riders[r]=[];
            riders[r]['ID']=parseInt($(rlistDiv[r]).attr("id").replace("riderprofile",""));
            riders[r]['name']=$(rlistNames[r]).text();
            //Add skills
            riders[r]['totalSkills']=0;
            for(s=(r*cNumber);s<((r*cNumber)+cNumber);s++)
            {
                riders[r][skills[s%cNumber]]=($(rlistSkills[s]).text());
                if (s%cNumber > 0 && s%cNumber < 9)
                {
                    riders[r]['totalSkills']+=parseInt($(rlistSkills[s]).text());
                }
                if (skills[s%cNumber] == 'AV')
                {
                    //$("#riderlist p:eq("+s+")").text((riders[r]['totalSkills']/8).toFixed(2));
                    riders[r]['realAV']=riders[r]['totalSkills']/8;
                }
            }
        }       
    }   
}

//Function improveRiderlist
//1. Add info about subscribed races
function improveRiderlist()
{
    //If there's not at least 1 rider in Riders array, then get riders
    if (!riders[0])
    {
        getRiders();
    }

    //If there's no info about races in Races element, then get races
    if (!races)
    {
        getRaces();
    }


    //Trigger riderObserver to improve profiles once opened
    riderObserver();

    for(r=0;r<riders.length;r++)
    {
        var imgsup= $("#riderlist").find("tr:eq("+(r*2+1)+")").find("[src=\'http://www.cyclingsimulator.com/Grafik/Statistik/signup.jpg\']");
        var numberRaces=0
        if($(imgsup).attr("title"))
        {
            if ($(imgsup).attr("title").match(/\d+/))
            {
                numberRaces=$(imgsup).attr("title").match(/\d+/)[0]
            }
            else
            {
                numberRaces=1;
            }
        }

        var racesFound = 0
        for (a=0;a<races.length;a++)
        {
            if ($(races[a]).attr("href").indexOf(riders[r]['ID']) >-1)               
            {
                racesFound += 1;
                if ($(imgsup).attr("title").indexOf(":")>-1)
                {
                    $(imgsup).attr("title",$(imgsup).attr("title")+", "+sup[Math.ceil(a/9)]);
                    a = Math.ceil(a/9)*9;
                }
                else
                {
                    $(imgsup).attr("title",$(imgsup).attr("title")+": "+sup[Math.ceil(a/9)]);
                    a = Math.ceil(a/9)*9;
                }
            }     
        }
        if (racesFound != numberRaces)
        {
            if ($(imgsup).attr("title").indexOf(":")>-1)
            {
                $(imgsup).attr("title",$(imgsup).attr("title")+", NT Race");

            }
            else
            {
                $(imgsup).attr("title",$(imgsup).attr("title")+": NT Race");
            }
        }
    }
}


//Function improveOnBreak
function improveOnBreak()
{     
    //First, get RE doctor.
    getDoctors();

    //Get riders info (DP) from riderlist
    getRiders();

    if(!redesign)
    {
        redesignRacebreakPage()
    }
    else
    {
        //If already redesigned, only redesign "Get all back" after reload since redesign of this particular cell gets overwritten by reload
        $("[width=298]:eq(5)").css("width","348");
    }

    //Get riders on break from ridersonbreakID element
    var ridersonbreak = $(ridersonbreakID).find("a");
    for (r=0;r<ridersonbreak.length-1;r++)//Loop through all links/riders in onbreak
    {
        var riderID = $(ridersonbreak[r]).attr("onClick").replace("getBackFromBreak(","").replace(")",""); //riderId in onClick
        for (l=0;l<riders.length;l++)//Loop through all riders in riderlist on main page
        {
            if (riders[l]['ID']==riderID) //If there's a match on riderId
            {                
                DP = riders[l]['DP']; // Get rider's DP from riderlist table


                //If a rider should be taken out of RB, make extra cells bold
                var cur_rb = $(ridersonbreakID).find("table:eq("+r+") td:last").text(); //Get Length value from on break table
                var subhelp = cur_rb.indexOf("hour");//subhelp to find how many hours a rider is in racebreak
                var cur_hours = parseInt(cur_rb)*24+parseInt(cur_rb.substring(subhelp-3,subhelp));//cur_hours is first number you find (days in race break) * 24, + number of hours found with subhelp 
                racebreakMetrics(DP, rb_doc_impact, cur_hours);

                if (cur_hours >= rb_hours)
                {
                    $(ridersonbreakID).find("table:eq("+r+")").css({ 'font-weight': 'bold' });
                }

                //Add info to table! Finally!
                $(ridersonbreakID).find("table:eq("+r+")").prop("title", "+1 in "+next_rise+" hour(s)");
                $(ridersonbreakID).find("table:eq("+r+") td:first").css("width","150");
                $(ridersonbreakID).find("table:eq("+r+") td:first").after("<td width=38><p class='right'><span class = 'text'>"+DP+"</span></p></td>");
                $(ridersonbreakID).find("table:eq("+r+") td:last").css("width","38");
                $(ridersonbreakID).find("table:eq("+r+") td:last").html($(ridersonbreakID).find("table:eq("+r+") td:last").html().replace(" days ","-").replace(" day ","-").replace(" hours","").replace(" hour","").replace("&nbsp;",""));
                $(ridersonbreakID).find("table:eq("+r+") td:last").after("<td width=38><p class='right'><span class = 'text'>"+(parseInt(DP)+parseInt(cur_rise))+"</span></p></td>");
                $(ridersonbreakID).find("table:eq("+r+") td:last").after("<td width=38><p class='right'><span class = 'text'>"+rb_days+"-"+rb_hour+"</span></p></td>");
                $(ridersonbreakID).find("table:eq("+r+") td:last").after("<td width=38><p class='right'><span class = 'text'>"+Math.min(parseInt(DP)+parseInt(Math.max(rb_rise,5)),99)+"</span></p></td>");
                $(ridersonbreakID).find("table:eq("+r+") td:last").after("<td width=8></td>");

                break;
            }
        }
    }
}

function getDoctors()
{
    rb_doc_impact = 1; //impact with no doctor =1 

    //Get RE doctor value from main page; this is horrible site design without ID's or classes
    var mpage = document.createElement("div");
    if(window.location.href.indexOf("/team/") > -1)
    {
        mpage.innerHTML = $(this).innerHTML;
    }
    else
    {
        mpage.innerHTML=$.ajax({ url: "http://www.cyclingsimulator.com/team/"+ownTeam.replace(" ","_"), global: false, async:false, success: function(data) {return data;} }).responseText;//Get HTML data from main site
    }
    var doctors = $(mpage).find("span:contains('Doctor')").parent().parent().parent().parent().parent().parent().parent().parent().next("table").find("td:eq(1)").find("td");//Impossible way to get all cells from table with Doctors
    var re_doc = 0
    if (doctors.length>1){re_doc = Math.max(re_doc,doctors[1].textContent)}//if there is more than 1 cell (you have at least 1 doctor), check RE level of doctor 1
    if (doctors.length>7){re_doc = Math.max(re_doc,doctors[7].textContent)}//if there are more than 7 cells (you have at least 2 doctors), check RE level of doctor 2
    if (doctors.length>13){re_doc = Math.max(re_doc,doctors[13].textContent)}//if there are more than 13 cells (you have 3 doctors), check RE level of doctor 3
    if (re_doc>=50) //if you have an RE doctor
    {rb_doc_impact += ((re_doc/5)-5)/100;}//Calculate extra DP increase percentage
}

function racebreakMetrics(DP, rb_doc_impact, cur_hours)
{         
    //Calculate RB rise and hours required according to Excel formula's
    rb_rise = Math.min(Math.floor(((rb_doc_impact*120*Math.max((100-Math.max(DP,50)),10))/240)),99-DP);
    cur_rise = Math.min(Math.floor(((rb_doc_impact*cur_hours*Math.max((100-Math.max(DP,50)),10))/240)),99-DP);
    rb_hours = Math.ceil((rb_rise*240)/rb_doc_impact/Math.max((100-Math.max(DP,50)),10));
    var rb_per_point = rb_hours/rb_rise;
    next_rise = Math.ceil(Math.round((rb_per_point-(cur_hours%rb_per_point))*100)/100);

    hours_dp99 += rb_hours;

    //Format for display:
    rb_days = Math.floor(rb_hours/24);
    rb_hour = rb_hours-(rb_days*24); 
}

function redesignRacebreakPage()
{
    //Another horrible piece of site design. Since nothing's one table you have to do multiple overrules width to make it look alright
    //This is the "send" table. I made this one smaller to be able to show extra data on on-break table
    $("[width=350]:first").css("width","300");
    $("[width=284]:first").css("width","234");
    $("[width=298]:first").css("width","248");
    $("[width=300]:first").css("width","250");

    //This is the on-break table. I made this one bigger to show the extra data.
    $("[width=350]:eq(1)").css("width","400");
    $("[width=284]:eq(1)").css("width","334");
    $("[width=298]:eq(3)").css("width","348");
    $("[width=298]:eq(4)").css("width","348");
    $("[width=298]:eq(5)").css("width","348");
    $("[width=300]:eq(1)").css("width","350");

    //Add extra boxtitles to on-break table for DP, Out & After
    $("[width=234]").parent().find("td:first").css("width","142");
    $("[width=234]").parent().find("td:first").after("<td width=38><p class = right><span class = 'boxtitle'>DP</span></p></td>");
    $("[width=234]").parent().find("td:last").css("width","38");
    $("[width=234]").parent().find("td:last").html("<p class = right><span class = 'boxtitle'>In</span></p>");
    $("[width=234]").parent().find("td:last").after("<td width=38><p class = right><span class = 'boxtitle'>Now</span></p></td>");
    $("[width=234]").parent().find("td:last").after("<td width=38><p class = right><span class = 'boxtitle'>Out</span></p></td>");
    $("[width=234]").parent().find("td:last").after("<td width=38><p class = right><span class = 'boxtitle'>After</span></p></td>");

    redesign="Done";//Set this variable to done, so it's not done again the next time the ridersonbreak table is refreshed.
}

function improveRiderProfile(riderprofile)
{
    var riderProfileID = document.querySelector("#"+riderprofile);
    var riderID=riderprofile.replace("riderprofile","");
    var xpl = "00"+riderProfileID.getElementsByClassName("text")[0].getElementsByTagName("td")[0].width;
    xpl = xpl.substr(xpl.length - 2);
    var xp = riderProfileID.textContent.substring(riderProfileID.textContent.indexOf("Experience"),riderProfileID.textContent.indexOf("Experience")+19);
    riderProfileID.innerHTML=riderProfileID.innerHTML.replace(xp,xp+"."+xpl);

    //Following lines to calculate the maximum Release Value and maximum profit for riders on the hirelist
    var riderStats = document.getElementById(riderProfileDiv).previousElementSibling;
    var maxBaseRV = 36000; //36000 = base RV at max DP (99) + RS (80)
    var totalstats=0;
    for (i = 1; i < 9; i++) 
    {
        stat=parseInt(riderStats.getElementsByClassName("right")[i].textContent);totalstats+=stat;maxBaseRV += 75*(stat-27); //75 extra RV for every point above 27 (and -75 for every point below 27)
        //Bonus RV for skills above 50
        if(stat>=50){maxBaseRV += 2500};
        if(stat>=60){maxBaseRV += 5000};
        if(stat>=70){maxBaseRV += 10000};
        if(stat>=80){maxBaseRV += 20000};
        if(stat>=90){maxBaseRV += 40000};
    };
    //Bonus RV based on AV (average, rounded up)
    av=Math.ceil(totalstats/8);
    if(av==41){maxBaseRV+=2000};
    if(av==42){maxBaseRV+=5000};
    if(av==43){maxBaseRV+=9000};
    if(av==44){maxBaseRV+=14000};
    if(av==45){maxBaseRV+=21500};
    if(av==46){maxBaseRV+=31500};
    if(av==47){maxBaseRV+=45500};
    if(av==48){maxBaseRV+=63500};
    if(av==49){maxBaseRV+=83500};
    if(av>=50){maxBaseRV+=108500};

    //Next part to get number of results from other page with ajax query. Bad for performance.
    var res = document.createElement("div");
    res.innerHTML=$.ajax({ url: "http://www.cyclingsimulator.com/?page=Rider%20Profile&id="+riderID, global: false, async:false, success: function(data) {return data;} }).responseText;
    res=res.querySelectorAll("span.boxtitle");
    var results = 0;
    for (r = 0; r<res.length;r++)
    {
        if(res[r].textContent.indexOf("Total") > -1) 
        {
            results += parseInt(res[r].textContent.replace("Total: ",""))
        }
    }
    maxBaseRV += (results*2000);
    //Next part to calculate age correction
    var ageCorrection = (maxBaseRV/25)*-(parseInt(riderStats.getElementsByClassName("right")[0].textContent)-22); //agecorrection first based on age (every year above 22 removes 1/25th of the maxBaseRV; every year below 22 adds 1/25th)
    bd = parseInt(riderProfileID.textContent.substring(riderProfileID.textContent.indexOf("Day")+4,riderProfileID.textContent.indexOf("Day")+6)); //Get birthday
    toptitle = document.getElementsByClassName("toptitle")[1].textContent; //Get topbar with current day
    cd = parseInt(toptitle.substring(toptitle.indexOf("Day")+4,toptitle.indexOf("Day")+6)); //Get current day
    if (bd>cd) //If birthday > current day 
    { 
        ageCorrection -= (90-bd+cd)/90*(maxBaseRV/25)
    } else 
    {
        ageCorrection -= (cd-bd)/90*(maxBaseRV/25)
    }
    maxRV = Math.max(Math.round(maxBaseRV+ageCorrection),29000); //Rounding and minimum value of 29000
    maxRVtxt = maxRV.toString(); //Converting to text for thousands separator etc.
    maxRVtxt = maxRVtxt.substr(0, maxRVtxt.length - 3)+"."+maxRVtxt.substr(maxRVtxt.length - 3)+" $"; //Converting to text for thousands separator etc.
    riderProfileID.getElementsByClassName("text")[1].innerHTML += "<br>Maximum RV: "+maxRVtxt;

    //On Hire page show Max RV in 30 days and potential profit additionally
    if(window.location.search.indexOf("Hire") > -1) 
    { 
        ageCorrection -= (1/3)*(maxBaseRV/25); //Extra age correction for 30 days ahead
        price = parseInt(riderStats.getElementsByClassName("right")[12].textContent.replace(".","")); //Get price from hirelist to calculate potential profite (ONLY AVAILABLE ON HIRELIST)
        maxRV2 = Math.max(Math.round(maxBaseRV+ageCorrection),29000); //Rounding and minimum value of 29000
        maxRV2txt = maxRV2.toString(); //Converting to text for thousands separator etc.
        maxRV2txt = maxRV2txt.substr(0, maxRV2txt.length - 3)+"."+maxRV2txt.substr(maxRV2txt.length - 3)+" $"; //Converting to text for thousands separator etc.
        profit = Math.max(maxRV2-price,0);
        profittxt = profit.toString();
        if(profittxt.length>3){point="."}else{point=""};
        profittxt = profittxt.substr(0, profittxt.length - 3)+point+profittxt.substr(profittxt.length - 3)+" $";
        riderProfileID.getElementsByClassName("text")[1].innerHTML += "<br>MaxRV in 30d: "+maxRV2txt+"<br>Expected profit: "+profittxt;
    };

    //Add rider link forum to profile
    riderProfileID.getElementsByClassName("text")[1].innerHTML += "<br><br>[rider]"+riderID+"[/rider]";

    //Replace AV by real AV
    for (r=0;r<riders.length;r++)
    {
        if(riders[r]['ID']==riderID)
        {
            riderProfileID.getElementsByClassName("text")[1].innerHTML = riderProfileID.getElementsByClassName("text")[1].innerHTML.replace("Average Skill: "+riders[r]['AV'],"Average Skill: "+riders[r]['realAV']);
        }
    }
}

function dp_trading(){
    $("#dpt").after('<BR>'+
                    '<table cellpadding="0" cellspacing="0" width = "700">'+
                    '<tr id = "dp_title" width="700" background="http://www.cyclingsimulator.com/Design/box_top_mid.gif" height="17">'+
                    '<td width="8" background="http://www.cyclingsimulator.com/Design/box_top_left_white.gif"></td>'+
                    '<td width="150"><span class="boxtitle">Rider</span></td>'+
                    '<td width="75"><span class="boxtitle">Since</span></td>' +
                    '<td width="38"><span class="boxtitle">DP</span></td>' +
                    '<td width="38"><span class="boxtitle">RS</span></td>' +
                    '<td width="55"><span class="boxtitle">Days left</span></td>' +
                    '<td width="65"><span class="boxtitle">Days DP99</span></td>' +
                    '<td width="65"><span class="boxtitle">Expected RS</span></td>' +
                    '<td></td>' +
                    '<td width="8" background="http://www.cyclingsimulator.com/Design/box_top_right_white.gif"></td>'+
                    '</tr></table>'+
                    '<table id="dp_riders" cellpadding="0" cellspacing="0" width = "700"'+
                    '</table>'
                   );
    getDoctors();
    var riderRB = document.createElement("div");
    riderRB.innerHTML=$.ajax({ url: "http://www.cyclingsimulator.com/?page=Break", global: false, async:false, success: function(data) {return data;} }).responseText;
    ridersonbreakID = riderRB.querySelector('#ridersonbreak');
    var ridersonbreak = $(ridersonbreakID).find("a");

    for(r=0;r<riders.length;r++)
    {
        riderID=riders[r]['ID'];
        var cur_hours = 0;
        for (b=0;b<ridersonbreak.length-1;b++)//Loop through all links/riders in onbreak
        {
            if(riderID == $(ridersonbreak[b]).attr("onClick").replace("getBackFromBreak(","").replace(")","")) //riderId in onClick
            {
                var cur_rb = $(ridersonbreakID).find("table:eq("+b+") td:last").text();
                var subhelp = cur_rb.indexOf("hour");//subhelp to find how many hours a rider is in racebreak
                var cur_hours = parseInt(cur_rb)*24+parseInt(cur_rb.substring(subhelp-3,subhelp));//cur_hours is first number you find (days in race break) * 24, + number of hours found with subhelp 
            }
        }

        var tr_color = "DDDDDD";
        if (r%2 == 0) {tr_color = "DDDDDD"} else {tr_color = "EEEEEE"};
        var riderP = document.createElement("div");
        riderP.innerHTML=$.ajax({ url: "http://www.cyclingsimulator.com/ajax_riderprofile.php?riderid="+riderID, global: false, async:false, success: function(data) {return data;} }).responseText;
        riderPText= $(riderP).text();
        var hiredate=riderPText.substring(riderPText.indexOf("since")+6,riderPText.indexOf("since")+16);
        var parts=hiredate.replace("-","/").split("/");      
        var hiredate2 = new Date(parts[2],parts[1]-1,parts[0]);
        Date.dateDiff = function(datepart, fromdate, todate) {	
            datepart = datepart.toLowerCase();	
            var diff = todate - fromdate;	
            var divideBy = { w:604800000, 
                            d:86400000, 
                            h:3600000, 
                            n:60000, 
                            s:1000 };	

            return Math.floor( diff/divideBy[datepart]);
        }
        var releasedate = Math.max(30-Date.dateDiff('d', hiredate2, new Date()),0);
        RS = riders[r]['RS'];
        hours_dp99=0;
        var dp_max = parseInt(riders[r]['DP']);
        while (dp_max < 99)
        {
            racebreakMetrics(dp_max,rb_doc_impact,0);
            dp_max+=rb_rise;
        }     
        hours_dp99 -= cur_hours;

        $("#dp_riders").append('<tr bgcolor='+tr_color+' height="19">'+
                               '<td width="1" background="http://www.cyclingsimulator.com/Design/box_border.gif"></td>'+
                               '<td width="7"></td>'+
                               '<td width="150"><span class="text">'+riders[r]['name']+'</span></td>'+
                               '<td width="75"><span class="text">'+hiredate+'</span></td>'+
                               '<td width="38"><span class="text">'+riders[r]['DP']+'</span></td>'+
                               '<td width="38"><span class="text">'+RS+'</span></td>'+
                               '<td width="55"><span class="text">'+releasedate+'</span></td>'+
                               '<td width="65"><span class="text">'+Math.ceil(hours_dp99/24)+'</span></td>'+
                               '<td width="65"><span class="text">'+(RS-Math.round((Math.max(releasedate,Math.ceil(hours_dp99/24)) *0.85)*100)/100)+'</span></td>'+
                               '<td></td>'+
                               '<td width="1" background="http://www.cyclingsimulator.com/Design/box_border.gif"></td>'+
                               '</tr>');
    }
    $("#dp_riders").append('<tr background="http://www.cyclingsimulator.com/Design/box_border.gif" height="1"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>');
    $("#dpt").css("display", "none") 
}

function getJobsAvailability()
{
    var oPage = document.createElement("div");
    oPage.innerHTML=$.ajax({ url: "http://www.cyclingsimulator.com/?page=Overview", global: false, async:false, success: function(data) {return data;} }).responseText;
    var jobsList = ["Hired autograph signing","Parade race","Political campaign","Presentation on sports","Shop opening","Training guidance","TV spot"]
    var months = [ "January", "February", "March", "April", "May", "June", 
                  "July", "August", "September", "October", "November", "December" ]

    for(j=0;j<jobsList.length;j++)
    {
        jobs[j]=[];
        jobs[j]['name']=jobsList[j];
        jobTime=$(oPage).find("span.moerkgroen:contains('"+jobsList[j]+"'):first").nextAll("span.smalltext").text();
        jobDate=$(oPage).find("span.moerkgroen:contains('"+jobsList[j]+"'):first").parents("table").prevAll("b:first").text();
        returnDate=new Date(jobDate.replace(" ","-"));
        returnDate.setDate(returnDate.getDate() + 14)
        jobs[j]['nextAvailable']=jobNextAvailable=returnDate.getDate()+" "+months[returnDate.getMonth()]+" "+jobTime;

    }
}

