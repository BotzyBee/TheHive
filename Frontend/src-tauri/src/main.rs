#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use thehive_lib::socket::{start_socket};

fn main(){
    start_socket()
}