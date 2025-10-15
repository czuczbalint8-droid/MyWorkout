// main.dart // Minimal, runnable Flutter app implementing the MVP described by the user. // - Email-only onboarding (simple, no backend) // - Offline-first storage using SharedPreferences (JSON) // - Four tabs: Today (workout & checkboxes), Schedule (choose training days), Edit (edit exercises for a day), Profile // - Per-exercise sets with adjustable weights and per-set completion // - Simple auto-progression rules (configurable per exercise name) // NOTE: This is an MVP skeleton to start from. For production replace SharedPreferences with SQLite / Hive

import 'dart:convert'; import 'package:flutter/material.dart'; import 'package:shared_preferences/shared_preferences.dart'; import 'package:uuid/uuid.dart';

void main() { runApp(MyApp()); }

// ------------------ Models ------------------

class ExerciseSet { int targetReps; double weightKg; bool completed;

ExerciseSet({required this.targetReps, required this.weightKg, this.completed = false});

Map<String, dynamic> toJson() => { 'targetReps': targetReps, 'weightKg': weightKg, 'completed': completed, };

static ExerciseSet fromJson(Map<String, dynamic> j) => ExerciseSet( targetReps: j['targetReps'], weightKg: (j['weightKg'] as num).toDouble(), completed: j['completed'] ?? false, ); }

class Exercise { String id; String name; String category; // "chest", "legs", "back", "arms", "cardio", "other" List<ExerciseSet> sets; double progressionStep; // e.g., 2.5

Exercise({ String? id, required this.name, required this.category, required this.sets, double? progressionStep, })  : id = id ?? Uuid().v4(), progressionStep = progressionStep ?? defaultProgressionForName(name);

Map<String, dynamic> toJson() => { 'id': id, 'name': name, 'category': category, 'sets': sets.map((s) => s.toJson()).toList(), 'progressionStep': progressionStep, };

static Exercise fromJson(Map<String, dynamic> j) => Exercise( id: j['id'], name: j['name'], category: j['category'], sets: (j['sets'] as List).map((e) => ExerciseSet.fromJson(Map<String, dynamic>.from(e))).toList(), progressionStep: (j['progressionStep'] as num?)?.toDouble(), ); }

// A plan stores for each weekday (0=Mon .. 6=Sun) a list of exercises class WorkoutPlan { Map<int, List<Exercise>> byWeekday;

WorkoutPlan({Map<int, List<Exercise>>? byWeekday}) : byWeekday = byWeekday ?? {};

Map<String, dynamic> toJson() => { 'byWeekday': byWeekday.map((k, v) => MapEntry(k.toString(), v.map((e) => e.toJson()).toList())), };

static WorkoutPlan fromJson(Map<String, dynamic> j) { final map = <int, List<Exercise>>{}; final byWeekday = Map<String, dynamic>.from(j['byWeekday'] ?? {}); byWeekday.forEach((k, v) { final idx = int.parse(k); map[idx] = (v as List).map((e) => Exercise.fromJson(Map<String, dynamic>.from(e))).toList(); }); return WorkoutPlan(byWeekday: map); } }

class UserProfile { String email; String displayName; String idCode; // unique 4-digit code String? avatarBase64;

UserProfile({required this.email, required this.displayName, required this.idCode, this.avatarBase64});

Map<String, dynamic> toJson() => { 'email': email, 'displayName': displayName, 'idCode': idCode, 'avatarBase64': avatarBase64, };

static UserProfile fromJson(Map<String, dynamic> j) => UserProfile( email: j['email'], displayName: j['displayName'], idCode: j['idCode'], avatarBase64: j['avatarBase64'], ); }

// ------------------ Helpers ------------------

double defaultProgressionForName(String name) { final lower = name.toLowerCase(); if (lower.contains('dead') || lower.contains('squat')) return 10.0; // heavier compound if (lower.contains('press') || lower.contains('bench')) return 2.5; return 2.5; // default }

String generate4DigitCode() { final rnd = DateTime.now().millisecondsSinceEpoch % 10000; return rnd.toString().padLeft(4, '0'); }

// ------------------ Storage Service ------------------

class StorageService { static const _kProfile = 'profile_v1'; static const _kPlan = 'plan_v1'; static const _kStats = 'stats_v1';

final SharedPreferences prefs;

StorageService._(this.prefs);

static Future<StorageService> init() async { final s = await SharedPreferences.getInstance(); return StorageService._(s); }

UserProfile? getProfile() { final s = prefs.getString(_kProfile); if (s == null) return null; return UserProfile.fromJson(json.decode(s)); }

Future<void> saveProfile(UserProfile p) async => prefs.setString(_kProfile, json.encode(p.toJson()));

WorkoutPlan getPlan() { final s = prefs.getString(_kPlan); if (s == null) return WorkoutPlan(); return WorkoutPlan.fromJson(json.decode(s)); }

Future<void> savePlan(WorkoutPlan plan) async => prefs.setString(_kPlan, json.encode(plan.toJson()));

Map<String, dynamic> getStats() { final s = prefs.getString(_kStats); if (s == null) return {}; return Map<String, dynamic>.from(json.decode(s)); }

Future<void> saveStats(Map<String, dynamic> st) async => prefs.setString(_kStats, json.encode(st)); }

// ------------------ App ------------------

class MyApp extends StatefulWidget { @override State<MyApp> createState() => _MyAppState(); }

class _MyAppState extends State<MyApp> { late Future<StorageService> _init;

@override void initState() { super.initState(); _init = StorageService.init(); }

@override Widget build(BuildContext context) { return FutureBuilder<StorageService>( future: _init, builder: (context, snap) { if (snap.connectionState != ConnectionState.done) return MaterialApp(home: Scaffold(body: Center(child: CircularProgressIndicator()))); final storage = snap.data!; return MaterialApp( title: 'MyWorkoutTracker', theme: ThemeData( primarySwatch: Colors.blue, brightness: Brightness.light, ), home: storage.getProfile() == null ? OnboardingScreen(storage: storage) : HomeScreen(storage: storage), ); }, ); } }

// ------------------ Onboarding / Login ------------------

class OnboardingScreen extends StatefulWidget { final StorageService storage; OnboardingScreen({required this.storage}); @override State<OnboardingScreen> createState() => _OnboardingScreenState(); }

class _OnboardingScreenState extends State<OnboardingScreen> { final _emailC = TextEditingController(); final _nameC = TextEditingController(); bool _saving = false;

void _createProfile() async { final email = _emailC.text.trim(); final name = _nameC.text.trim().isEmpty ? 'You' : _nameC.text.trim(); if (!email.contains('@')) { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Please enter a valid email'))); return; } setState(() => _saving = true); final profile = UserProfile(email: email, displayName: name, idCode: generate4DigitCode()); await widget.storage.saveProfile(profile); // create a default empty plan await widget.storage.savePlan(WorkoutPlan()); setState(() => saving = false); Navigator.of(context).pushReplacement(MaterialPageRoute(builder: () => HomeScreen(storage: widget.storage))); }

@override Widget build(BuildContext context) { return Scaffold( appBar: AppBar(title: Text('Welcome to MyWorkoutTracker')), body: Padding( padding: const EdgeInsets.all(16.0), child: Column(children: [ Text('Sign in with email to use the app offline', style: TextStyle(fontSize: 16)), SizedBox(height: 12), TextField(controller: _emailC, decoration: InputDecoration(labelText: 'Email')), SizedBox(height: 8), TextField(controller: _nameC, decoration: InputDecoration(labelText: 'Display name (optional)')), SizedBox(height: 16), ElevatedButton(onPressed: _saving ? null : _createProfile, child: _saving ? CircularProgressIndicator() : Text('Create account')), ]), ), ); } }

// ------------------ Home (tabs) ------------------

class HomeScreen extends StatefulWidget { final StorageService storage; HomeScreen({required this.storage}); @override State<HomeScreen> createState() => _HomeScreenState(); }

class _HomeScreenState extends State<HomeScreen> { int _tabIndex = 0;

void refresh() => setState(() {});

@override Widget build(BuildContext context) { final profile = widget.storage.getProfile()!; final tabs = [ TodayTab(storage: widget.storage, onChanged: refresh), ScheduleTab(storage: widget.storage, onChanged: refresh), EditTab(storage: widget.storage, onChanged: refresh), ProfileTab(storage: widget.storage, onSignOut: () async { // sign out final prefs = widget.storage.prefs; await prefs.remove(StorageService.kProfile); Navigator.of(context).pushReplacement(MaterialPageRoute(builder: () => OnboardingScreen(storage: widget.storage))); }), ];

return Scaffold(
  appBar: AppBar(title: Text('MyWorkoutTracker - ${profile.displayName}')),
  body: tabs[_tabIndex],
  bottomNavigationBar: BottomNavigationBar(
    type: BottomNavigationBarType.fixed,
    currentIndex: _tabIndex,
    onTap: (i) => setState(() => _tabIndex = i),
    items: [
      BottomNavigationBarItem(icon: Icon(Icons.fitness_center), label: 'Today'),
      BottomNavigationBarItem(icon: Icon(Icons.calendar_today), label: 'Schedule'),
      BottomNavigationBarItem(icon: Icon(Icons.edit), label: 'Edit'),
      BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
    ],
  ),
);

} }

// ------------------ Today Tab ------------------

class TodayTab extends StatefulWidget { final StorageService storage; final VoidCallback onChanged; TodayTab({required this.storage, required this.onChanged}); @override State<TodayTab> createState() => _TodayTabState(); }

class _TodayTabState extends State<TodayTab> { late WorkoutPlan plan;

@override void initState() { super.initState(); plan = widget.storage.getPlan(); }

List<Exercise> _todayExercises() { final wd = DateTime.now().weekday - 1; // Mon=0 return plan.byWeekday[wd] ?? []; }

void _savePlan() async { await widget.storage.savePlan(plan); widget.onChanged(); }

void _toggleSetCompleted(Exercise ex, int setIndex) async { final set = ex.sets[setIndex]; set.completed = !set.completed; // If all sets completed -> mark exercise complete: apply auto-progression final allDone = ex.sets.every((s) => s.completed); if (allDone) { // increment each set's base weight by progressionStep for next week for (var s in ex.sets) { s.weightKg = (s.weightKg + ex.progressionStep); } // reset completion for today's view (we still consider done for history, but reset for realtime) for (var s in ex.sets) s.completed = false; ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${ex.name}: completed -> next time +${ex.progressionStep}kg'))); }

await widget.storage.savePlan(plan);
setState(() {});

}

void _changeWeight(Exercise ex, int setIndex, double delta) async { final s = ex.sets[setIndex]; s.weightKg = (s.weightKg + delta); if (s.weightKg < 0) s.weightKg = 0; await widget.storage.savePlan(plan); setState(() {}); }

@override Widget build(BuildContext context) { final exs = todayExercises(); if (exs.isEmpty) return Center(child: Text('No exercises for today. Use Schedule or Edit to add.')); return ListView.builder( padding: EdgeInsets.all(12), itemCount: exs.length, itemBuilder: (context, i) { final ex = exs[i]; return Card( child: ExpansionTile( title: Row(children: [ Expanded(child: Text(ex.name)), Text('${ex.sets.length} sets'), ]), children: ex.sets.asMap().entries.map((entry) { final idx = entry.key; final s = entry.value; return ListTile( leading: Checkbox(value: s.completed, onChanged: () => _toggleSetCompleted(ex, idx)), title: Text('${s.targetReps} reps  ·  ${s.weightKg.toStringAsFixed(1)} kg'), trailing: Row(mainAxisSize: MainAxisSize.min, children: [ IconButton(onPressed: () => _changeWeight(ex, idx, -ex.progressionStep), icon: Icon(Icons.remove)), IconButton(onPressed: () => _changeWeight(ex, idx, ex.progressionStep), icon: Icon(Icons.add)), ]), ); }).toList(), ), ); }, ); } }

// ------------------ Schedule Tab ------------------

class ScheduleTab extends StatefulWidget { final StorageService storage; final VoidCallback onChanged; ScheduleTab({required this.storage, required this.onChanged}); @override State<ScheduleTab> createState() => _ScheduleTabState(); }

class ScheduleTabState extends State<ScheduleTab> { late WorkoutPlan plan; List<bool> selectedDays = List.generate(7, () => false);

@override void initState() { super.initState(); plan = widget.storage.getPlan(); // mark days that have exercises for (int d = 0; d < 7; d++) { selectedDays[d] = (plan.byWeekday[d]?.isNotEmpty ?? false); } }

void _toggleDay(int d) async { setState(() => selectedDays[d] = !selectedDays[d]); if (!selectedDays[d]) { plan.byWeekday.remove(d); } else { plan.byWeekday[d] = []; } await widget.storage.savePlan(plan); widget.onChanged(); }

@override Widget build(BuildContext context) { final names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; return Padding( padding: const EdgeInsets.all(12.0), child: Column(children: [ Text('Select which weekdays you train (days with exercises will show in Today)', style: TextStyle(fontSize: 14)), SizedBox(height: 12), Wrap(spacing: 8, children: List.generate(7, (i) { return FilterChip(label: Text(names[i]), selected: selectedDays[i], onSelected: (_) => toggleDay(i)); })), SizedBox(height: 20), Expanded(child: ListView.builder( itemCount: 7, itemBuilder: (context, i) { final list = plan.byWeekday[i] ?? []; return Card( child: ListTile( title: Text(names[i] + ' — ${list.length} exercises'), subtitle: list.isEmpty ? Text('No exercises') : Text(list.map((e) => e.name).join(', ')), onTap: () async { // open editor for day i await Navigator.of(context).push(MaterialPageRoute(builder: () => DayEditorScreen(storage: widget.storage, weekday: i))); setState(() => plan = widget.storage.getPlan()); }, ), ); }, )) ]), ); } }

// ------------------ Edit Tab ------------------

class EditTab extends StatefulWidget { final StorageService storage; final VoidCallback onChanged; EditTab({required this.storage, required this.onChanged}); @override State<EditTab> createState() => _EditTabState(); }

class _EditTabState extends State<EditTab> { @override Widget build(BuildContext context) { return Center(child: Text('Use Schedule to open day editor (tap a weekday)')); } }

class DayEditorScreen extends StatefulWidget { final StorageService storage; final int weekday; DayEditorScreen({required this.storage, required this.weekday}); @override State<DayEditorScreen> createState() => _DayEditorScreenState(); }

class _DayEditorScreenState extends State<DayEditorScreen> { late WorkoutPlan plan; final _nameC = TextEditingController(); String _category = 'chest'; int _reps = 10; double _weight = 20.0; int _sets = 3;

@override void initState() { super.initState(); plan = widget.storage.getPlan(); }

void _addExercise() async { final ex = Exercise(name: _nameC.text.isEmpty ? 'Unnamed' : _nameC.text, category: _category, sets: List.generate(sets, () => ExerciseSet(targetReps: _reps, weightKg: _weight))); plan.byWeekday.putIfAbsent(widget.weekday, () => []).add(ex); await widget.storage.savePlan(plan); setState(() { _nameC.clear(); }); }

void _removeExercise(String id) async { plan.byWeekday[widget.weekday]?.removeWhere((e) => e.id == id); await widget.storage.savePlan(plan); setState(() {}); }

@override Widget build(BuildContext context) { final list = plan.byWeekday[widget.weekday] ?? []; final names = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; return Scaffold( appBar: AppBar(title: Text('Edit — ${names[widget.weekday]}')), body: Padding( padding: const EdgeInsets.all(12.0), child: Column(children: [ Row(children: [Expanded(child: TextField(controller: _nameC, decoration: InputDecoration(labelText: 'Exercise name (optional)'))), SizedBox(width:8), DropdownButton<String>(value: _category, items: ['chest','legs','back','arms','cardio','other'].map((c) => DropdownMenuItem(value:c, child: Text(c))).toList(), onChanged: (v) { if (v!=null) setState(()=>_category=v);})]), SizedBox(height:8), Row(children:[Text('Sets:'), SizedBox(width:8), DropdownButton<int>(value:_sets, items:[1,2,3,4,5].map((i)=>DropdownMenuItem(value:i,child:Text(i.toString()))).toList(), onChanged:(v){if(v!=null) setState(()=>_sets=v);}), SizedBox(width:16), Text('Reps:'), SizedBox(width:8), DropdownButton<int>(value:_reps, items:[5,6,8,10,12,15].map((i)=>DropdownMenuItem(value:i,child:Text(i.toString()))).toList(), onChanged:(v){if(v!=null) setState(()=>_reps=v);}), SizedBox(width:16), Text('Weight:'), SizedBox(width:8), Container(width:80, child: TextField(decoration: InputDecoration(), controller: TextEditingController(text:_weight.toString()), onSubmitted: (val){ final d = double.tryParse(val); if(d!=null) setState(()=>_weight=d); })),]), SizedBox(height:8), ElevatedButton(onPressed: _addExercise, child: Text('Add exercise')), SizedBox(height:12), Expanded(child: ListView.builder(itemCount: list.length, itemBuilder: (context,i){ final ex=list[i]; return Card(child: ListTile(title: Text(ex.name), subtitle: Text('${ex.sets.length}×${ex.sets.first.targetReps}  ·  ${ex.sets.first.weightKg}kg'), trailing: IconButton(icon: Icon(Icons.delete), onPressed: ()=>_removeExercise(ex.id)))); })) ]), ), ); } }

// ------------------ Profile Tab ------------------

class ProfileTab extends StatefulWidget { final StorageService storage; final VoidCallback onSignOut; ProfileTab({required this.storage, required this.onSignOut}); @override State<ProfileTab> createState() => _ProfileTabState(); }

class _ProfileTabState extends State<ProfileTab> { late UserProfile profile;

@override void initState() { super.initState(); profile = widget.storage.getProfile()!; }

void _signOut() async { // For demo just call callback await widget.storage.prefs.remove(StorageService._kProfile); widget.onSignOut(); }

@override Widget build(BuildContext context) { return Padding( padding: const EdgeInsets.all(12.0), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [ Row(children: [CircleAvatar(child: Text(profile.displayName.isEmpty ? 'U' : profile.displayName[0])), SizedBox(width:12), Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(profile.displayName, style: TextStyle(fontSize:18, fontWeight: FontWeight.bold)), Text(profile.email), Text('Code: ${profile.idCode}')])]), SizedBox(height:16), Text('Stats (offline):'), SizedBox(height:8), // Simple stats placeholder Card(child: ListTile(title: Text('Total workout days'), subtitle: Text('Not implemented detailed stats'))), SizedBox(height:16), ElevatedButton.icon(onPressed: () { Navigator.of(context).push(MaterialPageRoute(builder: (_) => HelpScreen())); }, icon: Icon(Icons.help_outline), label: Text('Help & Tutorial')), Spacer(), ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: Colors.red), onPressed: _signOut, child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.exit_to_app), SizedBox(width:8), Text('Sign out')])), SizedBox(height:20) ]), ); } }

class HelpScreen extends StatelessWidget { @override Widget build(BuildContext context) { return Scaffold(appBar: AppBar(title: Text('Quick tutorial')), body: Padding(padding: EdgeInsets.all(12), child: ListView(children: [ ListTile(leading: Icon(Icons.login), title: Text('Login with email'), subtitle: Text('Your data stays on the device and the app works offline.')), ListTile(leading: Icon(Icons.calendar_today), title: Text('Schedule'), subtitle: Text('Choose which weekdays you train.')), ListTile(leading: Icon(Icons.edit), title: Text('Edit exercises'), subtitle: Text('Add exercises with sets, reps and starting weights.')), ListTile(leading: Icon(Icons.fitness_center), title: Text('Today'), subtitle: Text('Tap a set to mark as completed. When all sets of an exercise are completed, the app applies progression for next time.')), SizedBox(height:12), Text('Tip: you can adjust each set weight directly from Today view using + / - buttons.'), ]))); } }

// EOF

