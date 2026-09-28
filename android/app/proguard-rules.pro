# AiNotif Proguard Rules
-keepattributes *Annotation*
-keepclassmembers class * {
    @androidx.room.* *;
}
