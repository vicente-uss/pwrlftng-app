# Modelo de datos inicial

Este modelo guía la futura implementación SQLite/Supabase. En Sprint 01 los datos viven en memoria para validar UX rápido.

## users
- id
- email
- display_name
- body_weight
- height
- goal
- level
- created_at
- updated_at

## exercises
- id
- name
- primary_muscle
- secondary_muscles
- video_url
- is_unilateral
- created_at
- updated_at

## routines
- id
- user_id
- name
- day_index
- intensity_mode
- notes
- created_at
- updated_at

## routine_exercises
- id
- routine_id
- exercise_id
- order_index
- notes
- created_at
- updated_at

## routine_sets
- id
- routine_exercise_id
- set_index
- set_type
- target_weight_kg
- target_reps
- target_rep_range_min
- target_rep_range_max
- target_rpe
- target_rir
- rest_seconds
- is_warmup
- created_at
- updated_at

## workout_sessions
- id
- user_id
- routine_id
- started_at
- finished_at
- duration_seconds
- total_volume_kg
- notes
- status
- created_at
- updated_at

## workout_exercises
- id
- session_id
- exercise_id
- order_index
- notes
- created_at
- updated_at

## workout_sets
- id
- workout_exercise_id
- set_index
- set_type
- actual_weight_kg
- actual_reps
- actual_rpe
- actual_rir
- is_completed
- completed_at
- volume_kg
- created_at
- updated_at
